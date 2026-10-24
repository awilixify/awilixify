import { type AwilixContainer, Lifetime } from "awilix";
import { describe, expect, it, vi } from "vitest";
import { createDecoratorStateUpdater } from "../../lib/decorators/decorator-state.js";
import type { ModuleScope } from "../../lib/di/contexts/container-context-base.js";
import { DIContext } from "../../lib/di/contexts/di-context.js";
import { AsyncDIContext } from "../../lib/di/contexts/di-context-async.js";
import type { DiContextOptions } from "../../lib/di/contexts/di-context-base.js";
import * as ERRORS from "../../lib/di/errors.js";
import type { AnyModule } from "../../lib/di/modules/module.types.js";
import { overrideModule } from "../../lib/di/modules/module-overrides.js";
import {
	Initializer,
	type MetadataInitializerContext,
} from "../../lib/di/providers/provider.types.js";

type TestContainer = Omit<AwilixContainer, "resolve"> & {
	resolve<T = any>(name: string | symbol): T;
};

type TestModuleScope = Omit<ModuleScope, "scope" | "importedScopes"> & {
	scope: TestContainer;
	importedScopes: Map<string, TestModuleScope>;
};

class TestableBase {
	public resolveCount: number;
	public instanceId: number;

	constructor(protected deps?: any) {
		this.resolveCount = 1;
		this.instanceId = Math.random();
	}

	getDeps() {
		return this.deps;
	}

	getDepKeys() {
		return Object.keys(this.deps ?? {});
	}

	getName() {
		return this.constructor.name;
	}
}

function registerModule(
	module: Partial<AnyModule>,
	options?: Partial<DiContextOptions>,
): TestModuleScope {
	return DIContext.create(
		{
			name: "AnyModule",
			...module,
		},
		{
			containerOptions: {
				injectionMode: "PROXY",
			},
			...options,
		},
	);
}

async function registerModuleAsync(
	module: Partial<AnyModule>,
	options?: Partial<DiContextOptions>,
): Promise<TestModuleScope> {
	return AsyncDIContext.create(
		{
			name: "AnyModule",
			...module,
		},
		{
			containerOptions: {
				injectionMode: "PROXY",
			},
			...options,
		},
	);
}

describe("Lifecycle", () => {
	function createLifecycleInitializer(name: string, calls: string[]) {
		const { token, update } = createDecoratorStateUpdater(
			`lifecycle-${name}-initializer`,
			{
				method: () => ({ name }),
			},
		);

		class TestInitializer extends Initializer<typeof token, false> {
			readonly token = token;
			readonly usesInvoke = false;

			initialize(context: MetadataInitializerContext<typeof token>) {
				calls.push(
					`${name}:${String(context.methodName)}:${context.metadata.name}`,
				);
			}
		}

		return {
			decorate() {
				return (target: any, context: ClassMethodDecoratorContext) => {
					update(context, { method: () => ({ name }) });
					return target;
				};
			},
			Initializer: TestInitializer,
		};
	}

	it("should allow async factory provider with eager in sync create and resolve after init", async () => {
		let calls = 0;
		const app = registerModule({
			providers: {
				asyncService: {
					eager: true,
					inject: [],
					useFactory: async () => {
						calls += 1;
						return new TestableBase();
					},
				},
			},
		});

		expect(() => app.scope.resolve("asyncService")).toThrow(
			ERRORS.AsyncEagerFactoryRequiresInitError,
		);

		await app.init();

		expect(calls).toBe(1);
		expect(app.scope.resolve("asyncService")).toBeInstanceOf(TestableBase);
	});

	it("should call async eager factory disposer on app.dispose", async () => {
		const dispose = vi.fn(async () => {});

		const app = registerModule({
			providers: {
				asyncService: {
					eager: true,
					inject: [],
					useFactory: async () => new TestableBase(),
					dispose,
				},
			},
		});

		await app.init();
		await app.close();

		expect(dispose).toHaveBeenCalledTimes(1);
	});

	describe("Controller Initializers", () => {
		it("should skip controller initializers when init excludes initializers", async () => {
			const calls: string[] = [];
			const tracked = createLifecycleInitializer("tracked", calls);

			class DecoratedController {
				@tracked.decorate()
				handler() {
					return "ok";
				}
			}

			const app = registerModule({
				controllers: [DecoratedController],
				initializers: {
					tracked: tracked.Initializer,
				},
			});

			await app.init({ excludeInitializers: true });

			expect(calls).toEqual([]);
		});

		it("should skip controller initializers by key when init excludes initializer keys", async () => {
			const calls: string[] = [];
			const first = createLifecycleInitializer("first", calls);
			const second = createLifecycleInitializer("second", calls);

			class DecoratedController {
				@first.decorate()
				@second.decorate()
				handler() {
					return "ok";
				}
			}

			const app = registerModule({
				controllers: [DecoratedController],
				initializers: {
					first: first.Initializer,
					second: second.Initializer,
				},
			});

			await app.init({ excludeInitializers: ["first"] });

			expect(calls).toEqual(["second:handler:second"]);
		});
	});

	describe("Eager Provider Initialization", () => {
		it("should resolve eager class providers during init", async () => {
			const init = vi.fn();

			class EagerService {
				onInit = init;
			}

			const app = registerModule({
				providers: {
					eagerService: {
						eager: true,
						useClass: EagerService,
					},
				},
			});

			expect(init).not.toHaveBeenCalled();

			await app.init();

			const eagerService = app.scope.resolve<EagerService>("eagerService");

			expect(init).toHaveBeenCalledTimes(1);
			expect(app.scope.resolve("eagerService")).toBe(eagerService);
		});

		it("should resolve eager factory providers during init", async () => {
			const useFactory = vi.fn(() => new TestableBase());

			const app = registerModule({
				providers: {
					eagerService: {
						eager: true,
						useFactory,
					},
				},
			});

			expect(useFactory).not.toHaveBeenCalled();

			await app.init();

			const eagerService = app.scope.resolve<TestableBase>("eagerService");

			expect(useFactory).toHaveBeenCalledTimes(1);
			expect(app.scope.resolve("eagerService")).toBe(eagerService);
		});

		it.each([
			Lifetime.TRANSIENT,
			Lifetime.SCOPED,
		])("should reject eager %s class and factory providers during creation without resolving them", async (lifetime) => {
			const resolve = vi.fn();
			class Service {
				constructor() {
					resolve();
				}
			}

			for (const provider of [
				{ eager: true, lifetime, useClass: Service },
				{ eager: true, lifetime, useFactory: resolve },
			]) {
				const module = { providers: { service: provider } };
				expect(() => registerModule(module)).toThrow(
					ERRORS.EagerProviderRequiresSingletonLifetimeError,
				);
				await expect(registerModuleAsync(module)).rejects.toThrow(
					ERRORS.EagerProviderRequiresSingletonLifetimeError,
				);
			}
			expect(resolve).not.toHaveBeenCalled();
		});

		it("should validate effective eager lifetimes after module overrides", async () => {
			const module = {
				name: "App",
				providers: {
					service: { eager: true, useClass: TestableBase },
				},
			};
			const options = {
				moduleOverrides: [
					overrideModule(module, {
						providers: {
							service: {
								eager: true,
								useClass: TestableBase,
								lifetime: Lifetime.SCOPED,
							},
						},
					}),
				],
			};
			expect(() => DIContext.create(module, options)).toThrow(
				ERRORS.EagerProviderRequiresSingletonLifetimeError,
			);
			await expect(AsyncDIContext.create(module, options)).rejects.toThrow(
				ERRORS.EagerProviderRequiresSingletonLifetimeError,
			);
		});

		it("should await async onInit with DIContext", async () => {
			const calls: string[] = [];

			class EagerService {
				async onInit() {
					await Promise.resolve();
					calls.push("initialized");
				}
			}

			const app = registerModule({
				providers: {
					eagerService: {
						eager: true,
						useClass: EagerService,
					},
				},
			});

			await app.init();

			expect(calls).toEqual(["initialized"]);
			expect(app.scope.resolve("eagerService")).toBeInstanceOf(EagerService);
		});

		it("should call afterInit after onInit for eager providers", async () => {
			const calls: string[] = [];

			class EagerService {
				onInit() {
					calls.push("init");
				}

				afterInit() {
					calls.push("afterInit");
				}
			}

			const app = registerModule({
				providers: {
					eagerService: {
						eager: true,
						useClass: EagerService,
					},
				},
			});

			await app.init();

			expect(calls).toEqual(["init", "afterInit"]);
		});

		it("should run all onInit hooks before initializers and afterInit hooks afterward", async () => {
			const calls: string[] = [];
			const tracked = createLifecycleInitializer("tracked", calls);

			class EagerService {
				onInit() {
					calls.push("onInit");
				}

				async afterInit() {
					await Promise.resolve();
					calls.push("afterInit");
				}
			}

			class Controller {
				@tracked.decorate()
				handler() {}
			}

			const app = registerModule({
				providers: {
					first: { eager: true, useClass: EagerService },
					second: { eager: true, useClass: EagerService },
				},
				controllers: [Controller],
				initializers: { tracked: tracked.Initializer },
			});

			await app.init();
			await app.init();

			expect(calls).toEqual([
				"onInit",
				"onInit",
				"tracked:handler:tracked",
				"afterInit",
				"afterInit",
			]);
		});

		it("should not run startup hooks for resolved non-eager providers", async () => {
			const onInit = vi.fn();
			const afterInit = vi.fn();

			class LazyService {
				onInit = onInit;
				afterInit = afterInit;
			}

			const app = registerModule({ providers: { lazy: LazyService } });
			app.scope.resolve("lazy");
			await app.init();
			app.scope.resolve("lazy");

			expect(onInit).not.toHaveBeenCalled();
			expect(afterInit).not.toHaveBeenCalled();
		});

		it("should skip afterInit when init excludes afterInit", async () => {
			const calls: string[] = [];

			class EagerService {
				onInit() {
					calls.push("init");
				}

				afterInit() {
					calls.push("afterInit");
				}
			}

			const app = registerModule({
				providers: {
					eagerService: {
						eager: true,
						useClass: EagerService,
					},
				},
			});

			await app.init({ excludeAfterInit: true });

			expect(calls).toEqual(["init"]);
		});

		it("should skip afterInit by eager provider key", async () => {
			const calls: string[] = [];

			class FirstEagerService {
				afterInit() {
					calls.push("first");
				}
			}

			class SecondEagerService {
				afterInit() {
					calls.push("second");
				}
			}

			const app = registerModule({
				providers: {
					firstEagerService: {
						eager: true,
						useClass: FirstEagerService,
					},
					secondEagerService: {
						eager: true,
						useClass: SecondEagerService,
					},
				},
			});

			await app.init({ excludeAfterInit: ["firstEagerService"] });

			expect(calls).toEqual(["second"]);
		});

		it("should only run onInit once", async () => {
			const init = vi.fn();

			class EagerService {
				onInit = init;
			}

			const app = registerModule({
				providers: {
					eagerService: {
						eager: true,
						useClass: EagerService,
					},
				},
			});

			await app.init();
			await app.init();

			expect(init).toHaveBeenCalledTimes(1);
		});

		it("should await async onInit with AsyncDIContext", async () => {
			const init = vi.fn(async () => {});

			class EagerService {
				onInit = init;
			}

			const app = await registerModuleAsync({
				providers: {
					eagerService: {
						eager: true,
						useClass: EagerService,
					},
				},
			});

			expect(init).not.toHaveBeenCalled();

			await app.init();

			expect(init).toHaveBeenCalledTimes(1);
		});

		it("should resolve async eager factory dependencies before invoking the factory", async () => {
			const calls: string[] = [];

			const app = registerModule({
				providers: {
					dependency: {
						inject: [],
						useFactory: () => {
							calls.push("dependency");
							return new TestableBase({ token: "dep" });
						},
					},
					eagerService: {
						eager: true,
						inject: ["dependency"],
						useFactory: async (dependency: TestableBase) => {
							calls.push("eager");
							return new TestableBase({ dependency });
						},
					},
				},
			});

			await app.init();

			expect(calls).toEqual(["dependency", "eager"]);
			expect(app.scope.resolve<TestableBase>("eagerService").getDeps()).toEqual(
				{
					dependency: expect.any(TestableBase),
				},
			);
		});

		it("should initialize eager providers using initAfter order", async () => {
			const calls: string[] = [];

			class EnvService {
				onInit() {
					calls.push("env");
				}
			}

			class ConfigService {
				onInit() {
					calls.push("config");
				}
			}

			class DbService {
				onInit() {
					calls.push("db");
				}
			}

			const app = registerModule({
				providers: {
					db: {
						eager: true,
						initAfter: ["config"],
						useClass: DbService,
					},
					config: {
						eager: true,
						initAfter: ["env"],
						useClass: ConfigService,
					},
					env: {
						eager: true,
						useClass: EnvService,
					},
				},
			});

			await app.init();

			expect(calls).toEqual(["env", "config", "db"]);
		});

		it("should initialize eager providers after imported and global initAfter dependencies", async () => {
			const calls: string[] = [];

			class GlobalConfig {
				onInit() {
					calls.push("globalConfig");
				}
			}

			class ImportedCache {
				onInit() {
					calls.push("importedCache");
				}
			}

			class AppService {
				onInit() {
					calls.push("app");
				}
			}

			const GlobalModule: AnyModule = {
				name: "GlobalModule",
				providers: {
					globalConfig: {
						eager: true,
						useClass: GlobalConfig,
					},
				},
				exports: ["globalConfig"],
			};

			const ImportedModule: AnyModule = {
				name: "ImportedModule",
				providers: {
					importedCache: {
						eager: true,
						useClass: ImportedCache,
					},
				},
				exports: ["importedCache"],
			};

			const app = registerModule(
				{
					imports: [ImportedModule],
					providers: {
						appService: {
							eager: true,
							initAfter: ["globalConfig", "importedCache"],
							useClass: AppService,
						},
					},
				},
				{
					globalModules: [GlobalModule],
				},
			);

			await app.init();

			expect(calls.indexOf("globalConfig")).toBeLessThan(calls.indexOf("app"));
			expect(calls.indexOf("importedCache")).toBeLessThan(calls.indexOf("app"));
		});

		it("should throw when initAfter dependency is not eager", async () => {
			const app = registerModule({
				providers: {
					config: TestableBase,
					appService: {
						eager: true,
						initAfter: ["config"],
						useClass: TestableBase,
					},
				},
			});

			await expect(app.init()).rejects.toThrow(
				ERRORS.EagerProviderInitDependencyNotFoundError,
			);
		});

		it("should throw when initAfter dependencies are circular", async () => {
			const app = registerModule({
				providers: {
					a: {
						eager: true,
						initAfter: ["b"],
						useClass: TestableBase,
					},
					b: {
						eager: true,
						initAfter: ["a"],
						useClass: TestableBase,
					},
				},
			});

			await expect(app.init()).rejects.toThrow(
				ERRORS.CircularProviderInitDependencyError,
			);
		});
	});
});
