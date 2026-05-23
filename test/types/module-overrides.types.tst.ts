import { describe, expect, it } from "tstyche";
import { DIContext } from "../../lib/di/contexts/di-context.js";
import type { Module as M } from "../../lib/di/modules/module.types.js";
import type { ModuleDef as D } from "../../lib/di/modules/module-def.types.js";
import { createModule } from "../../lib/di/modules/module-factories.js";
import { overrideModule } from "../../lib/di/modules/module-overrides.js";
import type { MiddlewareContract } from "../../lib/mediator/middleware.types.js";

class GlobalService {
	private declare readonly __brand: never;
}

declare module "../../lib/di/modules/module-def.types.js" {
	interface GlobalDependencies {
		globalService: GlobalService;
	}
}

describe("DIContext root moduleOverrides", () => {
	class LocalService {
		private declare readonly __brand: never;

		getLocal() {
			return "local";
		}
	}
	class ImportedService {
		private declare readonly __brand: never;

		getImported() {
			return "imported";
		}
	}
	class WrongService {
		private declare readonly __brand: never;

		getWrong() {
			return "wrong";
		}
	}

	type ImportedDef = D<{
		providers: { importedService: ImportedService };
		exportKeys: ["importedService"];
	}>;
	const ImportedModule = createModule<ImportedDef>({
		name: "ImportedModule",
		providers: { importedService: ImportedService },
		exports: ["importedService"],
	});

	type RootDef = D<{
		providers: { localService: LocalService };
		imports: [M<ImportedDef>];
	}>;
	const RootModule = createModule<RootDef>({
		name: "RootModule",
		imports: [ImportedModule],
		providers: { localService: LocalService },
	});

	it("allows overriding root module own providers", () => {
		DIContext.create(RootModule, {
			moduleOverrides: [
				overrideModule(RootModule, {
					providers: {
						localService: LocalService,
					},
				}),
			],
		});
	});

	it("rejects imported providers in root moduleOverrides", () => {
		expect(
			DIContext.create(RootModule, {
				moduleOverrides: [
					overrideModule(RootModule, {
						providers: {
							importedService: ImportedService,
						},
					}),
				],
			}),
		).type.toRaiseError();
	});

	it("rejects wrong override class provider type", () => {
		expect(
			DIContext.create(RootModule, {
				moduleOverrides: [
					overrideModule(RootModule, {
						providers: {
							localService: WrongService,
						},
					}),
				],
			}),
		).type.toRaiseError();

		expect(
			DIContext.create(RootModule, {
				moduleOverrides: [
					overrideModule(RootModule, {
						providers: {
							localService: { useClass: WrongService },
						},
					}),
				],
			}),
		).type.toRaiseError();
	});
});

describe("DIContext moduleOverrides", () => {
	class LocalService {
		getLocal() {
			return "local";
		}
	}
	class WrongService {
		getWrong() {
			return "wrong";
		}
	}
	class AuthMiddleware {
		declare readonly contract: MiddlewareContract<"auth", { userId: string }>;

		async execute() {
			return { userId: "1" };
		}
	}
	class WrongAuthMiddleware {
		declare readonly contract: MiddlewareContract<"auth", { tenantId: string }>;

		async execute() {
			return { tenantId: "1" };
		}
	}

	type RootDef = D<{
		providers: { localService: LocalService };
		queryPreHandlers: { auth: AuthMiddleware };
	}>;
	const RootModule = createModule<RootDef>({
		name: "RootModule",
		providers: { localService: LocalService },
		queryPreHandlers: { auth: AuthMiddleware },
	});

	it("allows overriding module own providers and pre-handlers", () => {
		DIContext.create(RootModule, {
			moduleOverrides: [
				overrideModule(RootModule, {
					providers: {
						localService: LocalService,
					},
					queryPreHandlers: {
						auth: AuthMiddleware,
					},
				}),
			],
		});
	});

	it("rejects unknown module override provider and pre-handler keys", () => {
		expect(
			overrideModule(RootModule, {
				providers: {
					missingService: LocalService,
				},
			}),
		).type.toRaiseError();

		expect(
			overrideModule(RootModule, {
				queryPreHandlers: {
					missingAuth: AuthMiddleware,
				},
			}),
		).type.toRaiseError();
	});

	it("rejects wrong module override provider and pre-handler types", () => {
		expect(
			overrideModule(RootModule, {
				providers: {
					localService: WrongService,
				},
			}),
		).type.toRaiseError();

		expect(
			overrideModule(RootModule, {
				queryPreHandlers: {
					auth: WrongAuthMiddleware,
				},
			}),
		).type.toRaiseError();
	});
});
