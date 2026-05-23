import { type AwilixContainer, Lifetime } from "awilix";
import { describe, expect, it, vi } from "vitest";
import { createDecoratorStateUpdater } from "../../lib/decorators/decorator-state.js";
import { DIContext } from "../../lib/di/contexts/di-context.js";
import { AsyncDIContext } from "../../lib/di/contexts/di-context-async.js";
import type {
	DiContextOptions,
	ModuleScope,
} from "../../lib/di/contexts/di-context-base.js";
import * as ERRORS from "../../lib/di/errors.js";
import type { AnyModule } from "../../lib/di/modules/module.types.js";
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
		await app.dispose();

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
				init = init;
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

		it("should throw during init when eager provider uses non-singleton lifetime", async () => {
			const app = registerModule({
				providers: {
					eagerService: {
						eager: true,
						lifetime: Lifetime.TRANSIENT,
						useClass: TestableBase,
					},
				},
			});

			await expect(app.init()).rejects.toThrow(
				ERRORS.EagerProviderRequiresSingletonLifetimeError,
			);
		});

		it("should await async init with DIContext", async () => {
			const calls: string[] = [];

			class EagerService {
				async init() {
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

		it("should call postInit after init for eager providers", async () => {
			const calls: string[] = [];

			class EagerService {
				init() {
					calls.push("init");
				}

				postInit() {
					calls.push("postInit");
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

			expect(calls).toEqual(["init", "postInit"]);
		});

		it("should skip postInit when init excludes postInit", async () => {
			const calls: string[] = [];

			class EagerService {
				init() {
					calls.push("init");
				}

				postInit() {
					calls.push("postInit");
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

			await app.init({ excludePostInit: true });

			expect(calls).toEqual(["init"]);
		});

		it("should skip postInit by eager provider key", async () => {
			const calls: string[] = [];

			class FirstEagerService {
				postInit() {
					calls.push("first");
				}
			}

			class SecondEagerService {
				postInit() {
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

			await app.init({ excludePostInit: ["firstEagerService"] });

			expect(calls).toEqual(["second"]);
		});

		it("should only run init once", async () => {
			const init = vi.fn();

			class EagerService {
				init = init;
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

		it("should await async init with AsyncDIContext", async () => {
			const init = vi.fn(async () => {});

			class EagerService {
				init = init;
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
				init() {
					calls.push("env");
				}
			}

			class ConfigService {
				init() {
					calls.push("config");
				}
			}

			class DbService {
				init() {
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
				init() {
					calls.push("globalConfig");
				}
			}

			class ImportedCache {
				init() {
					calls.push("importedCache");
				}
			}

			class AppService {
				init() {
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
