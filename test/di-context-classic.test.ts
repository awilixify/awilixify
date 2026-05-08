import { type AwilixContainer, AwilixResolutionError, Lifetime } from "awilix";
import { describe, expect, it } from "vitest";
import {
	DIContext,
	type DiContextOptions,
	type ModuleScopeTree,
} from "../lib/di/di-context.js";
import * as ERRORS from "../lib/di/errors.js";
import type { AnyModule } from "../lib/di/module.types.js";
import type { ModuleDef } from "../lib/di/module-def.types.js";
import { createStaticModule, forwardRef } from "../lib/di/module-factories.js";
import type { ForwardRef, ModuleRef } from "../lib/di/module-ref.types.js";

// Test-only type: Override resolve to return 'any' for convenience
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
			name: "TestModule",
			...module,
		},
		{
			framework: {},
			...options,
		},
	);
}

describe("DIContext - CLASSIC Injection Mode - Circular Dependencies", () => {
	class ServiceA {
		public instanceId = Math.random();
		constructor(private serviceB: any) {}

		getInstanceId() {
			return this.instanceId;
		}
		getName() {
			return "ServiceA";
		}
		callB() {
			return this.serviceB.getName();
		}
		getB() {
			return this.serviceB;
		}
	}

	class ServiceB {
		public instanceId = Math.random();
		constructor(private serviceA: any) {}

		getInstanceId() {
			return this.instanceId;
		}
		getName() {
			return "ServiceB";
		}
		callA() {
			return this.serviceA.getName();
		}
		getA() {
			return this.serviceA;
		}
	}

	describe("Circular dependencies within one module", () => {
		it("should throw error when circular dependencies without allowCircular flag", () => {
			expect(() => {
				const { scope } = registerModule({
					providers: {
						serviceA: ServiceA,
						serviceB: ServiceB,
					},
				});

				scope.resolve("serviceA");
			}).toThrow(AwilixResolutionError);
		});

		it("should resolve circular dependencies with allowCircular flag", () => {
			const { scope } = registerModule({
				providers: {
					serviceA: {
						useClass: ServiceA,
						allowCircular: true,
					},
					serviceB: {
						useClass: ServiceB,
					},
				},
			});

			const serviceA = scope.resolve("serviceA");
			const serviceB = scope.resolve("serviceB");

			expect(serviceA.callB()).toBe("ServiceB");
			expect(serviceB.callA()).toBe("ServiceA");
		});
	});

	describe("Module circular dependencies with forwardRef", () => {
		it("should resolve circular dependencies between two modules", () => {
			type ModuleADef = ModuleDef<{
				providers: {
					serviceA: ServiceA;
				};
				imports: [ModuleRef<ModuleBDef>];
				exportKeys: ["serviceA"];
			}>;

			const ModuleA = createStaticModule<ModuleADef>({
				name: "ModuleA",
				imports: [] as unknown as [ForwardRef<any>],
				providers: {
					serviceA: ServiceA,
				},
				exports: ["serviceA"],
			});

			type ModuleBDef = ModuleDef<{
				providers: {
					serviceB: ServiceB;
				};
				exportKeys: ["serviceB"];
				imports: [typeof ModuleA];
			}>;

			const ModuleB = createStaticModule<ModuleBDef>({
				name: "ModuleB",
				imports: [ModuleA],
				providers: {
					serviceB: {
						useClass: ServiceB,
						allowCircular: true,
					},
				},
				exports: ["serviceB"],
			});

			ModuleA.imports = [forwardRef(() => ModuleB)];

			const { scope, importedScopes } = registerModule(ModuleA);

			const serviceA = scope.resolve("serviceA");
			const serviceB = importedScopes.get("ModuleB")?.scope.resolve("serviceB");

			expect(serviceA.callB()).toBe("ServiceB");
			expect(serviceB?.callA()).toBe("ServiceA");
		});

		it("should throw error when circular modules without forwardRef", () => {
			const ModuleA: AnyModule = {
				name: "ModuleA",
				imports: [],
			};

			const ModuleB: AnyModule = {
				name: "ModuleB",
				imports: [ModuleA],
			};

			ModuleA.imports = [ModuleB];

			expect(() => {
				registerModule(ModuleA);
			}).toThrow(ERRORS.CircularModuleDependencyError);
		});
	});

	describe("Lifetime handling with createProxyResolver (SINGLETON)", () => {
		it("should maintain SINGLETON lifetime for circular dependencies", () => {
			const { scope } = registerModule({
				providers: {
					serviceA: {
						useClass: ServiceA,
					},
					serviceB: {
						useClass: ServiceB,
						allowCircular: true,
					},
				},
			});

			const serviceA1 = scope.resolve("serviceA");
			const serviceA2 = scope.resolve("serviceA");
			const serviceB1 = scope.resolve("serviceB");
			const serviceB2 = scope.resolve("serviceB");

			expect(serviceA1.instanceId).toBe(serviceA2.instanceId);
			expect(serviceB1.instanceId).toBe(serviceB2.instanceId);

			expect(serviceA1.getB().instanceId).toBe(serviceB1.instanceId);
			expect(serviceB1.getA().instanceId).toBe(serviceA1.instanceId);
		});

		it("should maintain SINGLETON across module boundaries with circular deps", () => {
			type ModuleADef = ModuleDef<{
				providers: { serviceA: ServiceA };
				imports: [ModuleRef<ModuleBDef>];
				exportKeys: ["serviceA"];
			}>;

			const ModuleA = createStaticModule<ModuleADef>({
				name: "ModuleA",
				imports: [] as unknown as [ForwardRef<any>],
				providers: {
					serviceA: {
						useClass: ServiceA,
					},
				},
				exports: ["serviceA"],
			});

			type ModuleBDef = ModuleDef<{
				providers: { serviceB: ServiceB };
				exportKeys: ["serviceB"];
				imports: [typeof ModuleA];
			}>;

			const ModuleB = createStaticModule<ModuleBDef>({
				name: "ModuleB",
				imports: [ModuleA],
				providers: {
					serviceB: {
						useClass: ServiceB,
						allowCircular: true,
					},
				},
				exports: ["serviceB"],
			});

			ModuleA.imports = [forwardRef(() => ModuleB)];

			const { scope } = registerModule(ModuleA);

			const serviceA1 = scope.resolve("serviceA");
			const serviceA2 = scope.resolve("serviceA");
			const serviceB1 = scope.resolve("serviceB");
			const serviceB2 = scope.resolve("serviceB");

			expect(serviceA1.instanceId).toBe(serviceA2.instanceId);
			expect(serviceB1.instanceId).toBe(serviceB2.instanceId);
		});
	});

	describe("Lifetime handling with createProxyResolver (TRANSIENT)", () => {
		it("should create new instances for TRANSIENT lifetime with circular deps", () => {
			const { scope } = registerModule({
				providers: {
					serviceA: {
						useClass: ServiceA,
						lifetime: Lifetime.TRANSIENT,
					},
					serviceB: {
						useClass: ServiceB,
						allowCircular: true,
						lifetime: Lifetime.TRANSIENT,
					},
				},
			});

			const serviceA1 = scope.resolve("serviceA");
			const serviceA2 = scope.resolve("serviceA");
			const serviceB1 = scope.resolve("serviceB");
			const serviceB2 = scope.resolve("serviceB");

			expect(serviceA1.getB().instanceId).not.toBe(serviceA2.getB().instanceId);
			expect(serviceB1.getA().instanceId).not.toBe(serviceB2.getA().instanceId);
		});

		it("should handle TRANSIENT exports with circular module deps", () => {
			type ModuleADef = ModuleDef<{
				providers: { serviceA: ServiceA };
				imports: [ModuleRef<ModuleBDef>];
				exportKeys: ["serviceA"];
			}>;

			const ModuleA = createStaticModule<ModuleADef>({
				name: "ModuleA",
				imports: [] as unknown as [ForwardRef<any>],
				providers: {
					serviceA: {
						useClass: ServiceA,
						lifetime: Lifetime.TRANSIENT,
					},
				},
				exports: ["serviceA"],
			});

			type ModuleBDef = ModuleDef<{
				providers: { serviceB: ServiceB };
				exportKeys: ["serviceB"];
				imports: [typeof ModuleA];
			}>;

			const ModuleB = createStaticModule<ModuleBDef>({
				name: "ModuleB",
				imports: [ModuleA],
				providers: {
					serviceB: {
						useClass: ServiceB,
						allowCircular: true,
						lifetime: Lifetime.TRANSIENT,
					},
				},
				exports: ["serviceB"],
			});

			ModuleA.imports = [forwardRef(() => ModuleB)];

			const { scope } = registerModule(ModuleA);

			const serviceA1 = scope.resolve("serviceA");
			const serviceA2 = scope.resolve("serviceA");

			expect(serviceA1.getB().instanceId).not.toBe(serviceA2.getB().instanceId);
		});
	});

	describe("Lifetime handling with createProxyResolver (SCOPED)", () => {
		it("should maintain SCOPED lifetime within scope for circular deps", () => {
			const { scope } = registerModule({
				providers: {
					serviceA: {
						useClass: ServiceA,
						lifetime: Lifetime.SCOPED,
					},
					serviceB: {
						useClass: ServiceB,
						allowCircular: true,
						lifetime: Lifetime.SCOPED,
					},
				},
			});

			const newScope = scope.createScope();
			const scopedA1 = scope.resolve("serviceA");
			const scopedA2 = scope.resolve("serviceA");
			const newScopedA1 = newScope.resolve<any>("serviceA");
			const newScopedA2 = newScope.resolve<any>("serviceA");

			expect(scopedA1.getB().instanceId).toBe(scopedA2.getB().instanceId);
			expect(newScopedA1.getB().instanceId).not.toBe(
				scopedA2.getB().instanceId,
			);
			expect(newScopedA1.getB().instanceId).toBe(newScopedA2.getB().instanceId);
		});

		it("should handle SCOPED exports across circular modules", () => {
			type ModuleADef = ModuleDef<{
				providers: { serviceA: ServiceA };
				imports: [ModuleRef<ModuleBDef>];
				exportKeys: ["serviceA"];
			}>;

			const ModuleA = createStaticModule<ModuleADef>({
				name: "ModuleA",
				imports: [] as unknown as [ForwardRef<any>],
				providers: {
					serviceA: {
						useClass: ServiceA,
						lifetime: Lifetime.SCOPED,
					},
				},
				exports: ["serviceA"],
			});

			type ModuleBDef = ModuleDef<{
				providers: { serviceB: ServiceB };
				exportKeys: ["serviceB"];
				imports: [typeof ModuleA];
			}>;

			const ModuleB = createStaticModule<ModuleBDef>({
				name: "ModuleB",
				imports: [ModuleA],
				providers: {
					serviceB: {
						useClass: ServiceB,
						lifetime: Lifetime.SCOPED,
						allowCircular: true,
					},
				},
				exports: ["serviceB"],
			});

			ModuleA.imports = [forwardRef(() => ModuleB)];

			const { scope } = registerModule(ModuleA);

			const newScope = scope.createScope();
			const scopedA1 = scope.resolve("serviceA");
			const scopedA2 = scope.resolve("serviceA");
			const newScopedA1 = newScope.resolve<any>("serviceA");
			const newScopedA2 = newScope.resolve<any>("serviceA");

			expect(scopedA1.getB().instanceId).toBe(scopedA2.getB().instanceId);
			expect(newScopedA1.getB().instanceId).toBe(newScopedA2.getB().instanceId);
		});
	});
});

describe("DIContext - CLASSIC Injection Mode - globalModules", () => {
	class GlobalService {
		public instanceId = Math.random();
	}

	class ConsumerService {}

	it("should support SINGLETON, TRANSIENT and SCOPED lifetimes for global module exports", () => {
		const { scope } = registerModule(
			{},
			{
				globalModules: [
					{
						name: "GlobalModule",
						providers: {
							singletonService: GlobalService,
							transientService: {
								useClass: GlobalService,
								lifetime: Lifetime.TRANSIENT,
							},
							scopedService: {
								useClass: GlobalService,
								lifetime: Lifetime.SCOPED,
							},
						},
						exports: ["singletonService", "transientService", "scopedService"],
					},
				],
			},
		);

		const singletonA = scope.resolve("singletonService");
		const singletonB = scope.resolve("singletonService");
		expect(singletonA.instanceId).toBe(singletonB.instanceId);

		const transientA = scope.resolve("transientService");
		const transientB = scope.resolve("transientService");
		expect(transientA.instanceId).not.toBe(transientB.instanceId);

		const scopedRootA = scope.resolve("scopedService");
		const scopedRootB = scope.resolve("scopedService");
		expect(scopedRootA.instanceId).toBe(scopedRootB.instanceId);

		const childScope = scope.createScope<any>();

		const singletonC = childScope.resolve("singletonService");
		const scopedChildA = childScope.resolve("scopedService");
		const scopedChildB = childScope.resolve("scopedService");

		expect(singletonA.instanceId).toBe(singletonC.instanceId);
		expect(scopedChildA.instanceId).toBe(scopedChildB.instanceId);
	});

	it("should throw when globalModules has duplicate module names", () => {
		expect(() => {
			registerModule(
				{},
				{
					globalModules: [{ name: "SharedGlobal" }, { name: "SharedGlobal" }],
				},
			);
		}).toThrow(ERRORS.DuplicateModuleImportError);
	});

	it("should allow a global module to import a non-global module", () => {
		class ImportedService {}

		const { scope } = registerModule(
			{},
			{
				globalModules: [
					{
						name: "ValidGlobal",
						imports: [
							{
								name: "ImportedModule",
								providers: {
									importedService: ImportedService,
								},
								exports: ["importedService"],
							},
						],
						providers: {
							globalConsumer: class {
								constructor(public readonly importedService: ImportedService) {}
							},
						},
						exports: ["globalConsumer"],
					},
				],
			},
		);

		const consumer = scope.resolve<any>("globalConsumer");
		expect(consumer.importedService).toBeDefined();
	});

	it("should throw when a global module imports another global module", () => {
		const sharedGlobal = {
			name: "SharedGlobal",
		};

		expect(() => {
			registerModule(
				{},
				{
					globalModules: [
						{
							name: "InvalidGlobal",
							imports: [sharedGlobal],
						},
						sharedGlobal,
					],
				},
			);
		}).toThrow(ERRORS.GlobalModuleImportsGlobalModuleError);
	});

	it("should throw when local providers conflict with global module exports", () => {
		expect(() => {
			registerModule(
				{
					providers: {
						conflictService: ConsumerService,
					},
				},
				{
					globalModules: [
						{
							name: "GlobalModule",
							exports: ["conflictService"],
						},
					],
				},
			);
		}).toThrow(ERRORS.ProviderNameConflictError);
	});
});
