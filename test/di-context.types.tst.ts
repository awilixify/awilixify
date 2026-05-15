import { describe, expect, it } from "tstyche";
import type { EmptyObject } from "../lib/di/common.types.js";
import type { Module as M } from "../lib/di/modules/module.types.js";
import type {
	ModuleDef as D,
	GlobalDependencies,
} from "../lib/di/modules/module-def.types.js";
import {
	createFactoryProvider,
	createModule,
} from "../lib/di/modules/module-factories.js";

class GlobalService {
	private declare readonly __brand: never;
}

declare module "../lib/di/modules/module-def.types.js" {
	interface GlobalDependencies {
		globalService: GlobalService;
	}
}

describe("Module", () => {
	class P1 {
		private declare readonly __brand: never;
	}
	class P2 {
		private declare readonly __brand: never;
	}
	class P3 {
		private declare readonly __brand: never;
	}
	class P4 {
		private declare readonly __brand: never;
	}
	class P5 {
		private declare readonly __brand: never;
	}

	it("ensures ClassProvider can be passed as provider", () => {
		type M1 = M<D<{ providers: { p1: P1; p2: P2 } }>>;

		// Positive: Should accept useClass provider
		expect({
			name: "Module",
			providers: {
				p1: { useClass: P1 },
				p2: { useClass: P2 },
			},
		}).type.toBeAssignableTo<M1>();
		// Positive: Should accept useClass with options
		expect({
			name: "Module",
			providers: {
				p1: { useClass: P1, lifetime: "SINGLETON" as const },
				p2: { useClass: P2, lifetime: "SCOPED" as const },
			},
		}).type.toBeAssignableTo<M1>();
		// Negative: Should NOT accept wrong class type
		expect({
			name: "Module",
			providers: {
				p1: { useClass: P2 },
				p2: { useClass: P2 },
			},
		}).type.not.toBeAssignableTo<M1>();
	});

	it("ensures FactoryProvider can be passed as provider", () => {
		type M1 = M<D<{ providers: { p1: P1; p2: P2 } }>>;

		// Positive: Should accept factory provider with useFactory
		expect({
			name: "Module",
			providers: {
				p1: {
					useFactory: () => new P1(),
				},
				p2: P2,
			},
		}).type.toBeAssignableTo<M1>();
		// Positive: Should accept async factory provider with useFactory
		expect({
			name: "Module",
			providers: {
				p1: {
					useFactory: async () => new P1(),
				},
				p2: P2,
			},
		}).type.toBeAssignableTo<M1>();
		// Negative: Should NOT accept factory that returns wrong type
		expect({
			name: "Module",
			providers: {
				p1: {
					useFactory: () => new P2(),
				},
				p2: P2,
			},
		}).type.not.toBeAssignableTo<M1>();
	});

	it("ensures createFactoryProvider infers DepsMap from module", () => {
		type M1Def = D<{
			providers: { p1: P1; p2: P2; p3: P3 };
		}>;
		type Deps = M1Def["deps"];

		const factory = createFactoryProvider<Deps>();

		factory({
			inject: ["p1", "p2"] as const,
			useFactory: (_p1, _p2) => {
				expect<typeof _p1>().type.toBe<P1>();
				expect<typeof _p2>().type.toBe<P2>();

				return new P4();
			},
		});

		expect(
			factory({
				inject: ["p1", "p2"] as const,
				useFactory: (_p1, _p2, _p3) => {
					return new P4();
				},
			}),
		).type.toRaiseError();
	});

	it("ensures createFactoryProvider accepts ModuleDef and global dependencies", () => {
		type M1Def = D<{
			providers: { p1: P1 };
		}>;

		const factory = createFactoryProvider<M1Def>();

		factory({
			inject: ["p1", "globalService"],
			useFactory: (_p1, _globalService) => {
				expect<typeof _p1>().type.toBe<P1>();
				expect<typeof _globalService>().type.toBe<GlobalService>();

				return new P4();
			},
		});

		factory({
			inject: ["globalService"],
			useFactory: (_globalService) => {
				expect<typeof _globalService>().type.toBe<GlobalService>();

				return new P4();
			},
		});
	});

	it("ensures initAfter accepts local, imported, and global dependency keys", () => {
		type ImportedDef = D<{
			providers: { p2: P2 };
			exportKeys: ["p2"];
		}>;
		const ImportedModule = createModule<ImportedDef>({
			name: "ImportedModule",
			providers: { p2: P2 },
			exports: ["p2"],
		});

		type M1 = M<
			D<{
				imports: [typeof ImportedModule];
				providers: { p1: P1; p3: P3 };
			}>
		>;
		type M1Def = D<{
			imports: [typeof ImportedModule];
			providers: { p1: P1; p3: P3 };
		}>;

		expect<"missing">().type.not.toBeAssignableTo<keyof M1Def["deps"]>();

		expect({
			name: "Module",
			imports: [ImportedModule] as [typeof ImportedModule],
			providers: {
				p1: {
					eager: true,
					initAfter: ["p2", "p3", "globalService"] as const,
					useClass: P1,
				},
				p3: P3,
			},
		}).type.toBeAssignableTo<M1>();

		expect<"missing">().type.not.toBeAssignableTo<keyof M1Def["deps"]>();
	});

	it("ensures primitives can be passed as providers", () => {
		type M1 = M<
			D<{
				providers: { p1: ""; p2: boolean; p3: true; p4: 2 };
				exportKeys: ["p3"];
			}>
		>;

		expect({
			name: "Module",
			exports: ["p3"] as ["p3"],
			providers: { p1: "", p2: false, p3: true, p4: 2 },
		} as const).type.toBeAssignableTo<M1>();
	});

	it("ensures providers in definition and declaration are the same", () => {
		type M1 = M<
			D<{
				providers: { p1: P1; p2: P2 };
			}>
		>;

		// Positive: Should be assignable with correct providers
		expect({
			name: "Module",
			providers: { p1: P1, p2: P2 },
		}).type.toBeAssignableTo<M1>();
		// Negative: Should NOT be assignable if provider types are wrong
		expect({
			name: "Module",
			providers: { p1: true, p2: P2 },
		}).type.not.toBeAssignableTo<M1>();
		// Negative: Should NOT be assignable if provider types are wrong
		expect({
			name: "Module",
			providers: { p1: P1, p2: "" },
		}).type.not.toBeAssignableTo<M1>();
		// Negative: Should NOT be assignable if provider types are swapped
		expect({
			name: "Module",
			providers: { p1: P2, p2: P1 },
		}).type.not.toBeAssignableTo<M1>();
		// Negative: Should NOT be assignable if a provider is missing
		expect({
			name: "Module",
			providers: { p1: P1 },
		}).type.not.toBeAssignableTo<M1>();
		// Negative: Should NOT be assignable with empty providers
		expect({
			name: "Module",
			providers: {},
		}).type.not.toBeAssignableTo<M1>();
	});

	it("ensures imports in definition and declaration are the same", () => {
		type M1 = M<D<{ providers: { p1: P1 } }>>;

		type M2 = M<
			D<{
				imports: [M1];
			}>
		>;

		// Positive: Should match exact structure with M1
		expect<M2>().type.toBe<
			M<
				D<{
					imports: [M<D<{ providers: { p1: P1 } }>>];
				}>
			>
		>();
		// Negative: Should NOT be assignable if wrong provider type in imports
		expect<M2>().type.not.toBeAssignableTo<
			M<
				D<{
					imports: [M<D<{ providers: { p1: P2 } }>>];
				}>
			>
		>();
		// Negative: Should NOT be assignable with empty imports
		expect<M2>().type.not.toBeAssignableTo<
			M<
				D<{
					imports: [];
				}>
			>
		>();
		// Negative: Should NOT be assignable with no imports property
		expect<M2>().type.not.toBeAssignableTo<M<D<{ providers: EmptyObject }>>>();
	});

	it("ensures promised imports expose exported dependencies", () => {
		type ImportedDef = D<{
			providers: { p1: P1 };
			exportKeys: ["p1"];
		}>;

		const ImportedModule = createModule<ImportedDef>({
			name: "ImportedModule",
			providers: { p1: P1 },
			exports: ["p1"],
		});

		type AppDef = D<{
			imports: [Promise<typeof ImportedModule>];
			providers: { p2: P2 };
		}>;
		type Deps = AppDef["deps"];

		const factory = createFactoryProvider<Deps>();

		factory({
			inject: ["p1"] as const,
			useFactory: (_p1) => {
				expect<typeof _p1>().type.toBe<P1>();

				return new P2();
			},
		});
	});

	it("ensures exports in definition and declaration are the same", () => {
		type M1 = M<
			D<{
				providers: { p1: P1; p2: P2 };
				exportKeys: ["p1"];
			}>
		>;

		// Positive: Should be assignable with correct exports
		expect({
			name: "Module",
			providers: { p1: P1, p2: P2 },
			exports: ["p1"] as ["p1"],
		}).type.toBeAssignableTo<M1>();
		// Negative: Should NOT be assignable if wrong export type
		expect({
			name: "Module",
			providers: { p1: P2, p2: P2 },
			exports: ["p1"] as ["p1"],
		}).type.not.toBeAssignableTo<M1>();
		// Negative: Should NOT be assignable if different key is exported
		expect({
			name: "Module",
			providers: { p1: P1, p2: P2 },
			exports: ["p2"] as ["p2"],
		}).type.not.toBeAssignableTo<M1>();
		// Negative: Should NOT be assignable with no exports
		expect({
			name: "Module",
			providers: { p1: P1, p2: P2 },
		}).type.not.toBeAssignableTo<M1>();
		// Negative: Should NOT be assignable if both are exported
		expect({
			name: "Module",
			providers: { p1: P1, p2: P2 },
			exports: ["p1", "p2"] as ["p1", "p2"],
		}).type.not.toBeAssignableTo<M1>();
	});

	it("ensures dependencies are extracted correctly in def deps including exported from imported modules", () => {
		type M1 = M<
			D<{
				providers: { p1: P1; p5: P5 };
				exportKeys: ["p1"];
			}>
		>;
		type M2 = M<
			D<{
				providers: { p2: P2 };
				exportKeys: ["p2"];
			}>
		>;
		type M3 = M<
			D<{
				providers: { p3: P3 };
			}>
		>;

		type M4Def = D<{
			providers: { p4: P4 };
			imports: [M1, M2, M3];
		}>;

		type Deps = M4Def["deps"];
		type ExpectedDeps = { p4: P4 } & Pick<{ p1: P1 }, "p1"> &
			Pick<{ p2: P2 }, "p2"> &
			EmptyObject &
			GlobalDependencies;

		expect<Deps>().type.toBeAssignableTo<ExpectedDeps>();
		expect<ExpectedDeps>().type.toBeAssignableTo<Deps>();

		expect<{
			p1: P1;
			p2: P2;
			p4: P4;
			globalService: GlobalService;
		}>().type.toBeAssignableTo<Deps>();
		expect<{
			p1: P1;
			p2: P2;
			p4: P4;
			p5: P5;
			globalService: GlobalService;
		}>().type.toBeAssignableTo<Deps>();
		expect<{ p1: P1; p2: P2 }>().type.not.toBeAssignableTo<Deps>();
		expect<Deps>().type.not.toHaveProperty("p5");
		expect<Deps>().type.not.toHaveProperty("p3");
	});
});

describe("createModule", () => {
	class Service1 {
		private declare readonly __brand: never;
	}
	class Service2 {
		private declare readonly __brand: never;
	}
	class Service3 {
		private declare readonly __brand: never;
	}

	it("requires explicit TDef parameter - cannot be inferred", () => {
		type D1 = D<{
			providers: { p1: Service1 };
		}>;

		expect(
			createModule<D1>({
				name: "TestModule",
				providers: { p1: Service1 },
			}),
		).type.toBe<M<D1>>();
	});

	it("catches extra modules in imports", () => {
		type D2 = D<{
			providers: { service3: Service3 };
			exportKeys: ["service3"];
		}>;
		const Mod = createModule<D2>({
			name: "Mod",
			providers: { service3: Service3 },
			exports: ["service3"],
		});

		type M1 = M<D2>;
		type D1 = D<{
			providers: { service1: Service1 };
			imports: [M1];
		}>;

		expect(
			createModule<D1>({
				name: "TestModule",
				imports: [Mod, Mod],
				providers: {
					service1: Service1,
				},
			}),
		).type.toRaiseError();
	});

	it("catches extra properties in exports", () => {
		type D1 = D<{
			providers: { service1: Service1; service2: Service2 };
			exportKeys: ["service1"];
		}>;

		// Negative: Should reject extra properties in exports
		expect(
			createModule<D1>({
				name: "TestModule",
				providers: { service1: Service1, service2: Service2 },
				exports: ["service1", "service2"], // ❌ Extra export not in exportKeys
			}),
		).type.toRaiseError();
	});
});
