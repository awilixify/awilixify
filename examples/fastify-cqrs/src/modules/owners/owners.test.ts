import { DIContext, type ModuleScopeTree } from "awilixify";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { OwnersModule, Deps } from "./owners.module.js";
import { ConfigModule } from "@/integrations/config/config.module.js";

class Owners1Service {
	// private readonly instanceId = Math.random().toString(36).substring(7);

	constructor(private readonly catsService: Deps["catsService"]) {}

	getInstanceId(): string {
		return "";
	}

	getOwners1() {
		return {
			catsServiceId: this.catsService.getInstanceId(),
			owners1ServiceId: this.getInstanceId(),
		};
	}
}

describe("CatsModule", () => {
	let app: ModuleScopeTree | undefined;
	let queryMediator: Deps["queryMediator"];

	afterEach(async () => {
		await app?.dispose();
		app = undefined;
	});

	beforeAll(async () => {
		app = DIContext.create(OwnersModule, {
			globalModules: [ConfigModule],
			skipRegisterRoutes: true,
			providerOverrides: {
				owners1Service: Owners1Service,
			},
		});

		await app.init({ excludeInitializers: true });

		queryMediator = app.scope.resolve("queryMediator");
	});

	it("should bootstrap with initializers disabled", async () => {
		expect(queryMediator).toBeDefined();
	});
});
