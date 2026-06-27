import type * as Awilix from "awilix";
import { resolveDecoratorState } from "../../decorators/decorator-state.js";
import type { DevtoolsProcessorRef } from "../../devtools/devtools.types.js";
import { getControllerMethodNames } from "../../devtools/helpers.js";
import type { RegisteredModuleScope } from "../contexts/container-context-base.js";
import * as ERRORS from "../errors.js";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import type {
	ConstructorController,
	Initializer,
} from "../providers/provider.types.js";
import { runInRequestScopeContext } from "../request-scope-context.js";
import { KeyedFeatureRegistrar } from "./keyed-feature-registrar.js";
import type { ModuleInitOptions } from "./lifecycle-processor.js";

export type ControllerRuntimeEntry = {
	controllerClass: ConstructorController;
	resolve: () => any;
};

export type InitializerTask = (options?: ModuleInitOptions) => Promise<void>;

export class InitializerProcessor {
	private readonly keyedFeatureRegistrar = new KeyedFeatureRegistrar({});

	private readonly resolversByModule = new WeakMap<
		M,
		Map<string, () => Initializer>
	>();

	constructor(private readonly devtoolsProcessorRef: DevtoolsProcessorRef) {}

	public collectInitializers(
		m: M,
		scope: Awilix.AwilixContainer,
		importedModulesWithScope: RegisteredModuleScope[],
		controllers: ControllerRuntimeEntry[],
	): InitializerTask | null {
		this.resolversByModule.set(
			m,
			this.keyedFeatureRegistrar.register<Initializer>({
				featureKind: "initializers",
				module: m,
				scope,
				importedModulesWithScope,
			}),
		);

		const initializers = [
			...(
				this.resolversByModule.get(m) ??
				new Map<string, () => Initializer<any, boolean>>()
			).entries(),
		];

		if (initializers.length === 0 || controllers.length === 0) return null;

		this.devtoolsProcessorRef.current?.graphCollector.collectModuleRoutes({
			module: m,
			controllers,
			initializers,
		});

		return async (options) => {
			const activeInitializers = this.filterActiveInitializers(
				initializers,
				options,
			);

			if (activeInitializers.length === 0) return;

			for (const controller of controllers) {
				for (const methodName of getControllerMethodNames(
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
						activeInitializers,
					);

					for (const [, resolveInitializer] of activeInitializers) {
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
		initializers: Array<[string, () => Initializer<any, boolean>]>,
	): void {
		const invokableInitializers = initializers
			.map(([, resolver]) => resolver())
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

	private filterActiveInitializers(
		initializers: Array<[string, () => Initializer<any, boolean>]>,
		options?: ModuleInitOptions,
	): Array<[string, () => Initializer<any, boolean>]> {
		if (options?.excludeInitializers === true) return [];

		if (!Array.isArray(options?.excludeInitializers)) return initializers;

		const excludedKeys = new Set(options.excludeInitializers);

		return initializers.filter(([key]) => !excludedKeys.has(key));
	}
}
