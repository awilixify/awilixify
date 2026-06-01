import type { AwilixContainer } from "awilix";
import { describe, expect, it } from "vitest";
import type { ModuleScope } from "../../lib/di/contexts/container-context-base.js";
import { DIContext } from "../../lib/di/contexts/di-context.js";
import { AsyncDIContext } from "../../lib/di/contexts/di-context-async.js";
import type { DiContextOptions } from "../../lib/di/contexts/di-context-base.js";
import * as ERRORS from "../../lib/di/errors.js";
import type { AnyModule } from "../../lib/di/modules/module.types.js";
import { overrideModule } from "../../lib/di/modules/module-overrides.js";

type TestContainer = Omit<AwilixContainer, "resolve"> & {
	resolve<T = any>(name: string | symbol): T;
};

type TestModuleScope = Omit<ModuleScope, "scope" | "importedScopes"> & {
	scope: TestContainer;
	importedScopes: Map<string, TestModuleScope>;
};

class RealValueService {
	getValue() {
		return "real";
	}
}

class TestValueService {
	getValue() {
		return "test";
	}
}

function registerModule(
	module: AnyModule,
	options?: Partial<DiContextOptions>,
): TestModuleScope {
	return DIContext.create(module, {
		...options,
	});
}

async function registerModuleAsync(
	module: AnyModule | Promise<AnyModule>,
	options?: Partial<DiContextOptions>,
) {
	return AsyncDIContext.create(module, {
		...options,
	});
}

function createValueModule(name: string, providerKey: string) {
	return {
		name,
		providers: {
			[providerKey]: RealValueService,
		},
		exports: [providerKey],
	};
}

describe("Module overrides", () => {
	it("should override providers in the root module", () => {
		class ConsumerService {
			constructor(public readonly realService: RealValueService) {}
		}

		const AppModule = {
			name: "AppModule",
			providers: {
				realService: RealValueService,
				consumerService: ConsumerService,
			},
		};

		const app = registerModule(AppModule, {
			moduleOverrides: [
				overrideModule(AppModule, {
					providers: {
						realService: TestValueService,
					},
				}),
			],
		});

		const consumer = app.scope.resolve<ConsumerService>("consumerService");

		expect(consumer.realService.getValue()).toBe("test");
	});

	it("should override providers in a global module", () => {
		class ConsumerService {
			constructor(public readonly config: RealValueService) {}
		}

		const ConfigModule = createValueModule("ConfigModule", "config");

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
						config: TestValueService,
					},
				}),
			],
		});

		const consumer = app.scope.resolve<ConsumerService>("consumerService");

		expect(consumer.config.getValue()).toBe("test");
	});

	it("should override providers in a nested imported module", () => {
		class ParentConsumer {
			constructor(public readonly nestedService: RealValueService) {}
		}

		const NestedModule = createValueModule("NestedModule", "nestedService");

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
						nestedService: TestValueService,
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
		class FeatureService {
			constructor(public readonly cache: RealValueService) {}
		}

		function createCacheModule(name: string): AnyModule {
			return createValueModule(name, "cache");
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
						cache: TestValueService,
					},
				}),
			],
		});

		const featureService = app.scope.resolve<FeatureService>("featureService");

		expect(featureService.cache.getValue()).toBe("test");
	});

	it("should override providers in async imported modules", async () => {
		class ConsumerService {
			constructor(public readonly asyncService: RealValueService) {}
		}

		const AsyncImportedModule = createValueModule(
			"AsyncImportedModule",
			"asyncService",
		);

		const AppModule = {
			name: "AppModule",
			imports: [Promise.resolve(AsyncImportedModule)],
			providers: {
				consumerService: ConsumerService,
			},
		};

		const app = await registerModuleAsync(AppModule, {
			moduleOverrides: [
				overrideModule(AsyncImportedModule, {
					providers: {
						asyncService: TestValueService,
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

	it("should throw when overriding a root provider not declared by the root module", () => {
		class ImportedService {
			readonly instanceId = Math.random();
		}

		const ImportedModule: AnyModule = {
			name: "ImportedModule",
			providers: {
				importedService: ImportedService,
			},
			exports: ["importedService"],
		};

		const AppModule = {
			name: "AppModule",
			imports: [ImportedModule],
			providers: {},
		};

		expect(() => {
			registerModule(AppModule, {
				moduleOverrides: [
					overrideModule(AppModule, {
						providers: {
							importedService: ImportedService,
						},
					}),
				],
			});
		}).toThrow(ERRORS.ModuleFeatureOverrideNotFoundError);
	});
});
