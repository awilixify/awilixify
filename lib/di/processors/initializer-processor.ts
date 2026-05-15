import type * as Awilix from "awilix";
import { resolveDecoratorState } from "../../decorators/decorator-state.js";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import type {
	ConstructorController,
	Initializer,
} from "../providers/provider.types.js";
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
	): InitializerTask[] {
		this.processInitializerResolvers(m, scope, importedModulesWithScope);

		const initializers = this.resolversByModule.get(m) ?? new Map();

		if (initializers.size === 0 || controllers.length === 0) return [];

		return [
			async () => {
				for (const controller of controllers) {
					for (const methodName of this.getControllerMethodNames(
						controller.controllerClass,
					)) {
						const invoke = (...args: unknown[]) =>
							controller.resolve()[methodName](...args);

						for (const resolveInitializer of initializers.values()) {
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
								invoke,
							});
						}
					}
				}
			},
		];
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
