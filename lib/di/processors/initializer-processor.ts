import type * as Awilix from "awilix";
import { resolveDecoratorState } from "../../decorators/decorator-state.js";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import type {
	ConstructorController,
	Initializer,
} from "../providers/provider.types.js";
import { runInRequestScopeContext } from "../request-scope-context.js";
import * as ERRORS from "../errors.js";
import { KeyedFeatureRegistrar } from "./keyed-feature-registrar.js";

export type ControllerRuntimeEntry = {
	controllerClass: ConstructorController;
	resolve: () => any;
};

type ModuleWithScope = {
	module: M;
	scope: Awilix.AwilixContainer;
};

export type InitializerTask = () => Promise<void>;

export class InitializerProcessor {
	private readonly keyedFeatureRegistrar = new KeyedFeatureRegistrar({});

	private readonly resolversByModule = new WeakMap<
		M,
		Map<string, () => Initializer>
	>();

	public collectInitializers(
		m: M,
		scope: Awilix.AwilixContainer,
		importedModulesWithScope: ModuleWithScope[],
		controllers: ControllerRuntimeEntry[],
	): InitializerTask | null {
		this.processInitializerResolvers(m, scope, importedModulesWithScope);

		const initializers = [
			...(
				this.resolversByModule.get(m) ??
				new Map<string, () => Initializer<any, boolean>>()
			).values(),
		];

		if (initializers.length === 0 || controllers.length === 0) return null;

		return async () => {
			for (const controller of controllers) {
				for (const methodName of this.getControllerMethodNames(
					controller.controllerClass,
				)) {
					const invoke = (...args: unknown[]) =>
						runInRequestScopeContext(() =>
							controller.resolve()[methodName](...args),
						);

					this.ensureNoMultiInvokableInitializersPerMethod(
						m.name,
						methodName,
						controller,
						initializers,
					);

					for (const resolveInitializer of initializers) {
						const initializer = resolveInitializer();
						const decoratorState = resolveDecoratorState(
							controller.controllerClass,
							initializer.token,
						);

						if (decoratorState === null) continue;

						const metadata = decoratorState.methods.get(methodName);

						if (metadata === undefined) continue;

						await initializer.initialize({
							moduleName: m.name,
							target: controller.controllerClass,
							methodName,
							metadata,
							decoratorState,
							...(initializer.usesInvoke ? { invoke } : {}),
						});
					}
				}
			}
		};
	}

	private ensureNoMultiInvokableInitializersPerMethod(
		moduleName: string,
		methodName: string | symbol,
		controller: ControllerRuntimeEntry,
		initializers: Array<() => Initializer<any, boolean>>,
	): void {
		const invokableInitializers = initializers
			.map((resolver) => resolver())
			.filter((initializer) => {
				const decoratorState = resolveDecoratorState(
					controller.controllerClass,
					initializer.token,
				);

				return (
					decoratorState?.methods.has(methodName) === true &&
					initializer.usesInvoke === true
				);
			});

		if (invokableInitializers.length > 1) {
			throw new ERRORS.MultipleInvokeInitializersPerMethodError(
				moduleName,
				controller.controllerClass.name,
				String(methodName),
				invokableInitializers.map(
					(initializer) => initializer.constructor.name,
				),
			);
		}
	}

	private processInitializerResolvers(
		m: M,
		scope: Awilix.AwilixContainer,
		importedModulesWithScope: ModuleWithScope[],
	): void {
		this.resolversByModule.set(
			m,
			this.keyedFeatureRegistrar.register<Initializer>({
				featureKind: "initializers",
				module: m,
				scope,
				importedModulesWithScope,
			}),
		);
	}

	private getControllerMethodNames(
		controllerClass: ConstructorController,
	): Array<string | symbol> {
		const collected = new Set<string | symbol>();
		let proto = controllerClass.prototype;

		while (proto && proto !== Object.prototype) {
			Object.getOwnPropertyNames(proto)
				.filter(
					(name) => name !== "constructor" && typeof proto[name] === "function",
				)
				.forEach((name) => {
					collected.add(name);
				});

			Object.getOwnPropertySymbols(proto)
				.filter((symbol) => typeof proto[symbol] === "function")
				.forEach((symbol) => {
					collected.add(symbol);
				});

			proto = Object.getPrototypeOf(proto);
		}

		return [...collected];
	}
}
