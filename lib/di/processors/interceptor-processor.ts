import * as Awilix from "awilix";
import {
	hasDecoratorMethodMetadata,
	resolveDecoratorState,
} from "../../decorators/decorator-state.js";
import type { DecoratorState } from "../../decorators/decorator-state.types.js";
import type { DevtoolsProcessorRef } from "../../devtools/devtools.types.js";
import type { RegisteredModuleScope } from "../contexts/container-context-base.js";
import type { DiContextOptions } from "../contexts/di-context-base.js";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import type { InquirerResolverFactory } from "../providers/inquirer-resolver-factory.js";
import type { Interceptor } from "../providers/provider.types.js";
import { isPromiseLike } from "../type-guards.js";
import { KeyedFeatureRegistrar } from "./keyed-feature-registrar.js";

type InterceptorMetadata = {
	state: DecoratorState<any, any>;
	method: unknown;
};

export class InterceptorProcessor {
	private readonly keyedFeatureRegistrar: KeyedFeatureRegistrar;

	private readonly resolversByModule = new WeakMap<
		M,
		Map<string, () => Interceptor>
	>();

	constructor(
		providerOptions: DiContextOptions["providerOptions"],
		private readonly inquirerResolverFactory: InquirerResolverFactory,
		private readonly devtoolsProcessorRef: DevtoolsProcessorRef,
	) {
		this.keyedFeatureRegistrar = new KeyedFeatureRegistrar(
			providerOptions ?? {},
			inquirerResolverFactory,
		);
	}

	public processInterceptors(
		m: M,
		scope: Awilix.AwilixContainer,
		importedModulesWithScope: RegisteredModuleScope[],
	): void {
		const resolverMap = this.keyedFeatureRegistrar.register<Interceptor>({
			featureKind: "interceptors",
			module: m,
			scope,
			importedModulesWithScope,
		});

		this.resolversByModule.set(m, resolverMap);
	}

	public createInterceptedProviderResolver({
		module,
		useClass,
		options,
		resolver,
	}: {
		module: M;
		useClass: new (...args: any[]) => object;
		options: Awilix.BuildResolverOptions<any>;
		resolver?: Awilix.Resolver<any>;
	}): Awilix.Resolver<any> {
		const baseResolver =
			resolver || this.inquirerResolverFactory.create(useClass, options);
		const interceptors = [
			...(this.resolversByModule.get(module)?.values() ?? []),
		];

		if (interceptors.length === 0) {
			return baseResolver;
		}

		if (!hasDecoratorMethodMetadata(useClass)) {
			return baseResolver;
		}

		return Awilix.createBuildResolver({
			...options,
			resolve: (container) =>
				this.createInterceptedProviderInstance(
					baseResolver.resolve(container),
					useClass,
					interceptors,
					module.name,
				),
		});
	}

	private createInterceptedProviderInstance<T extends object>(
		instance: T,
		metadataTarget: object,
		resolveInterceptors: Array<() => Interceptor>,
		moduleName: string,
	): T {
		const wrappers = new Map<PropertyKey, (...args: unknown[]) => unknown>();
		let selfCallsPrepared = false;
		const self = this;

		return new Proxy(instance, {
			get(target, propertyKey, proxyReceiver) {
				const value = Reflect.get(target, propertyKey, proxyReceiver);

				if (typeof value !== "function") return value;
				// Class references must pass through unwrapped: wrapping
				// `constructor` masks the class name (constructor.name becomes
				// "wrapped") and wrapped classes cannot be called with `new`.
				if (propertyKey === "constructor") return value;
				if (isClassReference(value)) return value;

				const existing = wrappers.get(propertyKey);

				if (existing) return existing;

				const wrapped = (...args: unknown[]) => {
					const interceptors = resolveInterceptors.map((resolve) => resolve());

					if (!selfCallsPrepared) {
						self.prepareSelfCalls(
							target,
							metadataTarget,
							interceptors,
							proxyReceiver,
						);
						selfCallsPrepared = true;
					}

					const metadataByToken = self.collectInterceptorMetadata(
						metadataTarget,
						propertyKey,
						interceptors,
					);

					if (metadataByToken.size === 0) return value.apply(target, args);

					return self.callWithInterceptorChain({
						target,
						methodName: propertyKey,
						moduleName,
						args,
						metadataByToken,
						interceptors,
						proceed: () => value.apply(target, args),
					});
				};

				wrappers.set(propertyKey, wrapped);

				return wrapped;
			},
		});
	}

	private prepareSelfCalls(
		instance: object,
		metadataTarget: object,
		interceptors: Interceptor[],
		proxy: object,
	): void {
		const methodNames = new Set<string | symbol>();

		for (const interceptor of interceptors) {
			const state = resolveDecoratorState(metadataTarget, interceptor.token);

			for (const methodName of state?.methods.keys() ?? []) {
				methodNames.add(methodName);
			}
		}

		for (const methodName of methodNames) {
			if (methodName === "constructor") continue;

			const method = Reflect.get(proxy, methodName);

			if (typeof method !== "function" || isClassReference(method)) continue;

			// Calls through this bypass the DI proxy, so decorated methods need
			// instance-level wrappers for their interceptors to run internally.
			Object.defineProperty(instance, methodName, {
				configurable: true,
				enumerable: false,
				writable: true,
				...Object.getOwnPropertyDescriptor(instance, methodName),
				value: method,
			});
		}
	}

	private collectInterceptorMetadata(
		metadataTarget: object,
		propertyKey: string | symbol,
		interceptors: Interceptor[],
	): Map<symbol, InterceptorMetadata> {
		const metadataByToken = new Map<symbol, InterceptorMetadata>();

		for (const interceptor of interceptors) {
			const state = resolveDecoratorState(metadataTarget, interceptor.token);

			if (state === null) continue;

			const method = state.methods.get(propertyKey);

			if (method !== undefined) {
				metadataByToken.set(interceptor.token.stateSymbol, {
					state,
					method,
				});
			}
		}

		return metadataByToken;
	}

	private callWithInterceptorChain({
		target,
		methodName,
		moduleName,
		args,
		metadataByToken,
		interceptors,
		proceed,
	}: {
		target: object;
		methodName: string | symbol;
		moduleName: string;
		args: unknown[];
		metadataByToken: Map<symbol, InterceptorMetadata>;
		interceptors: Interceptor[];
		proceed: () => unknown | Promise<unknown>;
	}): unknown | Promise<unknown> {
		const invoke = (
			index: number,
			next: () => unknown | Promise<unknown>,
		): unknown | Promise<unknown> => {
			if (index >= interceptors.length) return next();

			const current = interceptors[index];

			if (!current) return next();
			const metadata = metadataByToken.get(current.token.stateSymbol);

			if (metadata === undefined) {
				return invoke(index + 1, next);
			}

			const callInterceptor = () =>
				current.intercept({
					target,
					methodName,
					args,
					moduleName,
					metadata: metadata.method,
					decoratorState: metadata.state,
					proceed: () => invoke(index + 1, next),
				});

			// Keep a narrowed tracer reference for callbacks below.
			const devtoolsTracer = this.devtoolsTracer;
			if (!devtoolsTracer) return callInterceptor();

			// Track proceed() duration to calculate interceptor's self-time
			let proceedDurationMs = 0;
			const trackedProceed = () => {
				const proceedStart = Date.now();
				try {
					const result = devtoolsTracer.runInCurrentSpan(() =>
						invoke(index + 1, next),
					);

					if (isPromiseLike(result)) {
						return Promise.resolve(result).finally(() => {
							proceedDurationMs += Date.now() - proceedStart;
						});
					}

					proceedDurationMs += Date.now() - proceedStart;
					return result;
				} catch (error) {
					proceedDurationMs += Date.now() - proceedStart;
					throw error;
				}
			};

			const trackedCallInterceptor = () =>
				current.intercept({
					target,
					methodName,
					args,
					moduleName,
					metadata: metadata.method,
					decoratorState: metadata.state,
					proceed: trackedProceed,
				});

			return devtoolsTracer.recordSpan({
				kind: "interceptor",
				moduleName,
				className: current.constructor.name,
				registrationKey: current.constructor.name,
				methodName: "intercept",
				args: [
					{
						moduleName,
						methodName,
						decoratorName:
							metadata.state.decoratorNames.get(methodName) ??
							extractDecoratorDescription(
								current.token.stateSymbol.description,
							),
						metadata: serializeMetadata(metadata.method),
					},
				],
				getProceedDurationMs: () => proceedDurationMs,
				callback: trackedCallInterceptor,
			});
		};

		return invoke(0, proceed);
	}

	private get devtoolsTracer() {
		return this.devtoolsProcessorRef.current?.tracer;
	}
}

function serializeMetadata(value: unknown, depth = 0): unknown {
	if (depth > 5) return "[...]";
	if (value === null || value === undefined) return value;
	if (typeof value === "function") return value.toString();
	if (typeof value !== "object") return value;

	if (Array.isArray(value)) {
		return value.map((item) => serializeMetadata(item, depth + 1));
	}

	const result: Record<string, unknown> = {};
	for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
		result[key] = serializeMetadata(val, depth + 1);
	}
	return result;
}

function extractDecoratorDescription(
	description: string | undefined,
): string | null {
	if (!description) return null;

	const prefix = "DecoratorState:";

	if (description.startsWith(prefix)) {
		return description.slice(prefix.length);
	}

	return description;
}

function isClassReference(value: {
	prototype?: { constructor?: unknown };
}): boolean {
	return Boolean(value.prototype && value.prototype.constructor === value);
}
