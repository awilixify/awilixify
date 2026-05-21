import type { AwilixContainer } from "awilix";
import { describe, expect, it } from "vitest";

import { DIContext } from "../../lib/di/contexts/di-context.js";
import type {
	ModuleScopeTree,
	DiContextOptions,
} from "../../lib/di/contexts/di-context-base.js";
import { AsyncDIContext } from "../../lib/di/contexts/di-context-async.js";
import { overrideModule } from "../../lib/di/contexts/module-overrides.js";
import * as ERRORS from "../../lib/di/errors.js";
import type { AnyModule } from "../../lib/di/modules/module.types.js";

type TestContainer = Omit<AwilixContainer, "resolve"> & {
	resolve<T = any>(name: string | symbol): T;
};

type TestModuleScopeTree = Omit<ModuleScopeTree, "scope" | "importedScopes"> & {
	scope: TestContainer;
	importedScopes: Map<string, TestModuleScopeTree>;
};

function registerModule(
	module: AnyModule,
	options?: Partial<DiContextOptions>,
): TestModuleScopeTree {
	return DIContext.create(module, {
		containerOptions: {
			injectionMode: "CLASSIC",
		},
		...options,
	});
}

describe("Module overrides", () => {
	it("should override providers in a global module", () => {
		class RealConfig {
			getValue() {
				return "real";
			}
		}

		class ConsumerService {
			constructor(public readonly config: RealConfig) {}
		}

		const ConfigModule = {
			name: "ConfigModule",
			providers: {
				config: RealConfig,
			},
			exports: ["config"],
		};

		const AppModule = {
			name: "AppModule",
			providers: {
				consumerService: ConsumerService,
			},
		};

		const app = registerModule(AppModule, {
			globalModules: [ConfigModule],
			moduleOverrides: [
				overrideModule(ConfigModule, {
					providers: {
						config: {
							getValue() {
								return "test";
							},
						},
					},
				}),
			],
		});

		const consumer = app.scope.resolve<ConsumerService>("consumerService");

		expect(consumer.config.getValue()).toBe("test");
	});

	it("should override providers in a nested imported module", () => {
		class RealService {
			getValue() {
				return "real";
			}
		}

		class ParentConsumer {
			constructor(public readonly nestedService: RealService) {}
		}

		const NestedModule = {
			name: "NestedModule",
			providers: {
				nestedService: RealService,
			},
			exports: ["nestedService"],
		};

		const ParentModule = {
			name: "ParentModule",
			imports: [NestedModule],
			providers: {
				parentConsumer: ParentConsumer,
			},
			exports: ["parentConsumer"],
		};

		const AppModule = {
			name: "AppModule",
			imports: [ParentModule],
		};

		const app = registerModule(AppModule, {
			moduleOverrides: [
				overrideModule(NestedModule, {
					providers: {
						nestedService: {
							getValue() {
								return "test";
							},
						},
					},
				}),
			],
		});

		const parentScope = app.importedScopes.get("ParentModule");
		const parentConsumer =
			parentScope?.scope.resolve<ParentConsumer>("parentConsumer");

		expect(parentConsumer?.nestedService.getValue()).toBe("test");
	});

	it("should override pre-handlers in an imported module", async () => {
		class DenyAuthMiddleware {
			async execute() {
				return { userId: "real-user" };
			}
		}

		class AllowAuthMiddleware {
			async execute() {
				return { userId: "test-user" };
			}
		}

		class GetUserHandler {
			static readonly key = "get-user";

			async executor(_: unknown, context: { userId: string }) {
				return context.userId;
			}
		}

		const FeatureModule = {
			name: "FeatureModule",
			queryHandlers: [GetUserHandler],
			queryPreHandlers: {
				auth: DenyAuthMiddleware,
			},
		};

		const AppModule = {
			name: "AppModule",
			imports: [FeatureModule],
		};

		const app = registerModule(AppModule, {
			moduleOverrides: [
				overrideModule(FeatureModule, {
					queryPreHandlers: {
						auth: AllowAuthMiddleware,
					},
				}),
			],
		});

		const featureScope = app.importedScopes.get("FeatureModule");
		const queryMediator = featureScope?.scope.resolve<any>("queryMediator");

		await expect(queryMediator.execute("get-user", {})).resolves.toBe(
			"test-user",
		);
	});

	it("should override a hoisted dynamic module instance", () => {
		class RealCache {
			getValue() {
				return "real";
			}
		}

		class FeatureService {
			constructor(public readonly cache: RealCache) {}
		}

		function createCacheModule(name: string): AnyModule {
			return {
				name,
				providers: {
					cache: RealCache,
				},
				exports: ["cache"],
			};
		}

		const CacheModule = createCacheModule("CacheModule");
		const FeatureModule = {
			name: "FeatureModule",
			imports: [CacheModule],
			providers: {
				featureService: FeatureService,
			},
		};

		const app = registerModule(FeatureModule, {
			moduleOverrides: [
				overrideModule(CacheModule, {
					providers: {
						cache: {
							getValue() {
								return "test";
							},
						},
					},
				}),
			],
		});

		const featureService = app.scope.resolve<FeatureService>("featureService");

		expect(featureService.cache.getValue()).toBe("test");
	});

	it("should override providers in async imported modules", async () => {
		class RealService {
			getValue() {
				return "real";
			}
		}

		class ConsumerService {
			constructor(public readonly asyncService: RealService) {}
		}

		const AsyncImportedModule = {
			name: "AsyncImportedModule",
			providers: {
				asyncService: RealService,
			},
			exports: ["asyncService"],
		};

		const AppModule = {
			name: "AppModule",
			imports: [Promise.resolve(AsyncImportedModule)],
			providers: {
				consumerService: ConsumerService,
			},
		};

		const app = await AsyncDIContext.create(AppModule, {
			containerOptions: {
				injectionMode: "CLASSIC",
			},
			moduleOverrides: [
				overrideModule(AsyncImportedModule, {
					providers: {
						asyncService: {
							getValue() {
								return "test";
							},
						},
					},
				}),
			],
		});

		const consumer = app.scope.resolve<ConsumerService>("consumerService");

		expect(consumer.asyncService.getValue()).toBe("test");
	});

	it("should throw when an override target is not in the module graph", () => {
		const MissingModule = {
			name: "MissingModule",
			providers: {
				missingService: class MissingService {},
			},
		};

		const AppModule = {
			name: "AppModule",
		};

		expect(() => {
			registerModule(AppModule, {
				moduleOverrides: [
					overrideModule(MissingModule, {
						providers: {
							missingService: class TestMissingService {},
						},
					}),
				],
			});
		}).toThrow(ERRORS.ModuleOverrideTargetNotFoundError);
	});

	it("should throw when overriding a feature not declared by the target module", () => {
		const TargetModule = {
			name: "TargetModule",
			providers: {
				targetService: class TargetService {},
			},
		};

		expect(() => {
			registerModule(TargetModule, {
				moduleOverrides: [
					overrideModule(TargetModule, {
						queryPreHandlers: {
							auth: class AuthMiddleware {},
						},
					}),
				],
			});
		}).toThrow(ERRORS.ModuleFeatureOverrideNotFoundError);
	});
});
