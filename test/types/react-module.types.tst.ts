import { describe, expect, it } from "tstyche";
import type {
	InferComponentDeps,
	InferProviderDeps,
	ModuleDef,
	WithDepsOnly,
	WithoutDeps,
} from "../../lib/react/react-module.types.js";
import { createModule } from "../../lib/react/react-module-factories.js";

describe("Module provider dependencies", () => {
	class Service {
		private declare readonly __brand: never;
	}

	function Page(_props: WithDepsOnly<AppDeps>) {
		return null;
	}

	const components = { Page };
	type AppDef = ModuleDef<{
		providers: { service: Service };
		components: typeof components;
	}>;
	interface AppDeps extends InferComponentDeps<AppDef> {}
	interface AppProviderDeps extends InferProviderDeps<AppDef> {}

	it("does not allow providers to inject local components", () => {
		expect(
			createModule<AppDef>({
				name: "AppModule",
				providers: {
					service: {
						inject: ["Page"],
						useFactory: () => new Service(),
					},
				},
				components,
			}),
		).type.toRaiseError();
	});

	it("does not allow provider initAfter to reference local components", () => {
		expect(
			createModule<AppDef>({
				name: "AppModule",
				providers: {
					service: {
						useClass: Service,
						initAfter: ["Page"],
					},
				},
				components,
			}),
		).type.toRaiseError();
	});

	it("allows components to use local components through deps", () => {
		function Shell({ deps }: WithDepsOnly<AppDeps>) {
			expect<typeof deps.Page>().type.toBe<WithoutDeps<typeof Page>>();

			return null;
		}

		const shellComponents = { ...components, Shell };
		type ShellDef = ModuleDef<{
			providers: { service: Service };
			components: typeof shellComponents;
		}>;

		createModule<ShellDef>({
			name: "ShellModule",
			providers: { service: Service },
			components: shellComponents,
		});
	});

	it("keeps provider deps separate from component deps", () => {
		expect<AppProviderDeps>().type.toHaveProperty("service");
		expect<AppProviderDeps>().type.not.toHaveProperty("Page");
		expect<AppDeps>().type.toHaveProperty("service");
		expect<AppDeps>().type.toHaveProperty("Page");
	});
});

describe("Module imported component dependencies", () => {
	class Service {
		private declare readonly __brand: never;
	}

	function FeaturePage(_props: WithDepsOnly<FeatureDeps>) {
		return null;
	}

	const featureComponents = { FeaturePage };
	type FeatureDef = ModuleDef<{
		components: typeof featureComponents;
		componentExportKeys: ["FeaturePage"];
	}>;
	interface FeatureDeps extends InferComponentDeps<FeatureDef> {}

	const FeatureModule = createModule<FeatureDef>({
		name: "FeatureModule",
		components: featureComponents,
		componentExports: ["FeaturePage"],
	});

	type AppDef = ModuleDef<{
		providers: { service: Service };
		imports: [typeof FeatureModule];
	}>;
	interface AppDeps extends InferComponentDeps<AppDef> {}
	interface AppProviderDeps extends InferProviderDeps<AppDef> {}

	it("does not allow providers to inject imported components", () => {
		expect(
			createModule<AppDef>({
				name: "AppModule",
				imports: [FeatureModule],
				providers: {
					service: {
						inject: ["FeaturePage"],
						useFactory: () => new Service(),
					},
				},
			}),
		).type.toRaiseError();
	});

	it("allows components to use imported components through deps", () => {
		function Shell({ deps }: WithDepsOnly<AppDeps>) {
			expect<typeof deps.FeaturePage>().type.toBe<
				WithoutDeps<typeof FeaturePage>
			>();

			return null;
		}

		const shellComponents = { Shell };
		type ShellDef = ModuleDef<{
			providers: { service: Service };
			imports: [typeof FeatureModule];
			components: typeof shellComponents;
		}>;

		createModule<ShellDef>({
			name: "ShellModule",
			imports: [FeatureModule],
			providers: { service: Service },
			components: shellComponents,
		});
	});

	it("keeps imported component exports out of provider deps", () => {
		expect<AppProviderDeps>().type.toHaveProperty("service");
		expect<AppProviderDeps>().type.not.toHaveProperty("FeaturePage");
		expect<AppDeps>().type.toHaveProperty("service");
		expect<AppDeps>().type.toHaveProperty("FeaturePage");
	});
});

describe("Module provider lifetimes", () => {
	class Service {
		private declare readonly __brand: never;
	}

	type AppDef = ModuleDef<{
		providers: { service: Service };
	}>;

	it("allows singleton and transient provider lifetimes", () => {
		createModule<AppDef>({
			name: "AppModule",
			providers: {
				service: {
					useClass: Service,
					lifetime: "SINGLETON",
				},
			},
		});

		createModule<AppDef>({
			name: "AppModule",
			providers: {
				service: {
					useClass: Service,
					lifetime: "TRANSIENT",
				},
			},
		});
	});

	it("does not allow scoped provider lifetime", () => {
		expect(
			createModule<AppDef>({
				name: "AppModule",
				providers: {
					service: {
						useClass: Service,
						lifetime: "SCOPED",
					},
				},
			}),
		).type.toRaiseError();
	});

	it("does not allow scoped module providerOptions lifetime", () => {
		expect(
			createModule<AppDef>({
				name: "AppModule",
				providerOptions: {
					lifetime: "SCOPED",
				},
				providers: {
					service: Service,
				},
			}),
		).type.toRaiseError();
	});
});
