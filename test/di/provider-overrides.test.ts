import type { AwilixContainer } from "awilix";
import { describe, expect, it } from "vitest";

import { DIContext } from "../../lib/di/contexts/di-context.js";
import type {
	ModuleScopeTree,
	DiContextOptions,
} from "../../lib/di/contexts/di-context-base.js";
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
	module: Partial<AnyModule>,
	options?: Partial<DiContextOptions>,
): TestModuleScopeTree {
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

describe("Provider overrides", () => {
	class TestableBase {
		public resolveCount = 1;
		public instanceId = Math.random();
	}

	it("should override root module own providers", () => {
		class RealService {
			getValue() {
				return "real";
			}
		}

		class ConsumerService {
			constructor(public readonly realService: RealService) {}
		}

		const fakeService = {
			getValue() {
				return "fake";
			},
		} as RealService;

		const app = registerModule(
			{
				providers: {
					realService: RealService,
					consumerService: ConsumerService,
				},
			},
			{
				containerOptions: {
					injectionMode: "CLASSIC",
				},
				providerOverrides: {
					realService: fakeService,
				},
			},
		);

		const consumer = app.scope.resolve<ConsumerService>("consumerService");

		expect(consumer.realService.getValue()).toBe("fake");
	});

	it("should reject overrides for providers not declared by root module", () => {
		const importedModule: AnyModule = {
			name: "ImportedModule",
			providers: {
				importedService: TestableBase,
			},
			exports: ["importedService"],
		};

		expect(() => {
			registerModule(
				{
					name: "MainModule",
					imports: [importedModule],
					providers: {},
				},
				{
					providerOverrides: {
						importedService: new TestableBase(),
					},
				},
			);
		}).toThrow(ERRORS.ProviderOverrideNotFoundError);
	});
});
