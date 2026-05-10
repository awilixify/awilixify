import {
	type AwilixContainer,
	type BuildResolverOptions,
	Lifetime,
} from "awilix";
import { describe, expect, it, vi } from "vitest";
import {
	DIContext,
	type DiContextOptions,
	type ModuleScopeTree,
} from "../lib/di/di-context.js";
import * as ERRORS from "../lib/di/errors.js";
import type { AnyModule } from "../lib/di/module.types.js";
import type { ModuleDef } from "../lib/di/module-def.types.js";
import {
	createFactoryProvider,
	createStaticModule,
	forwardRef,
} from "../lib/di/module-factories.js";
import type { ModuleRef } from "../lib/di/module-ref.types.js";

// Test-only type: Override resolve to return 'any' for convenience
type TestContainer = Omit<AwilixContainer, "resolve"> & {
	resolve<T = any>(name: string | symbol): T;
};

type TestModuleScopeTree = Omit<ModuleScopeTree, "scope" | "importedScopes"> & {
	scope: TestContainer;
	importedScopes: Map<string, TestModuleScopeTree>;
};

describe("DIContext", () => {
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

	const mockedExpress = {
		get: vi.fn(),
		post: vi.fn(),
		put: vi.fn(),
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
				framework: mockedExpress,
				containerOptions: {
					injectionMode: "PROXY",
				},
				...options,
			},
		);
	}

	describe("Ensure that module interactions/declarations are correct", () => {
		it("should throw an error when a module has duplicate imports", () => {
			const importedModule: AnyModule = {
				name: "SharedModule",
			};

			expect(() => {
				registerModule({
					name: "MainModule",
					imports: [importedModule, importedModule],
				});
			}).toThrow(ERRORS.DuplicateModuleImportError);
		});

		it("should throw an error when a module has provider name conflicts with imported modules", () => {
			expect(() => {
				registerModule({
					name: "MainModule",
					imports: [
						{
							name: "AnyModule",
							providers: {
								sharedService: class SharedService extends TestableBase {},
							},
							exports: ["sharedService"],
						},
					],
					providers: {
						sharedService: class ConflictingService extends TestableBase {},
					},
				});
			}).toThrow(ERRORS.ProviderNameConflictError);
		});

		it("should throw an error when local query pre-handler conflicts with imported exported query pre-handler", () => {
			class ImportedQueryMiddleware extends TestableBase {}
			class LocalQueryMiddleware extends TestableBase {}

			expect(() => {
				registerModule({
					name: "MainModule",
					imports: [
						{
							name: "ImportedModule",
							queryPreHandlers: {
								auth: ImportedQueryMiddleware,
							},
							queryPreHandlerExports: ["auth"],
						},
					],
					queryPreHandlers: {
						auth: LocalQueryMiddleware,
					},
				});
			}).toThrow(ERRORS.MiddlewareNameConflictError);
		});

		it("should throw an error when imported modules export conflicting query pre-handler names", () => {
			class ImportedQueryMiddlewareA extends TestableBase {}
			class ImportedQueryMiddlewareB extends TestableBase {}

			expect(() => {
				registerModule({
					name: "MainModule",
					imports: [
						{
							name: "ImportedModuleA",
							queryPreHandlers: {
								auth: ImportedQueryMiddlewareA,
							},
							queryPreHandlerExports: ["auth"],
						},
						{
							name: "ImportedModuleB",
							queryPreHandlers: {
								auth: ImportedQueryMiddlewareB,
							},
							queryPreHandlerExports: ["auth"],
						},
					],
				});
			}).toThrow(ERRORS.MiddlewareNameConflictError);
		});

		it("should throw an error when factory provider depends on non-existent provider", () => {
			expect(() => {
				registerModule({
					name: "InvalidFactoryModule",
					providers: {
						factoryService: {
							provide: TestableBase,
							inject: ["nonExistentService"],
							useFactory: () => new TestableBase(),
						},
					},
				});
			}).toThrow(ERRORS.DependencyNotFoundError);
		});

		it("should throw an error when factory providers have circular dependencies", () => {
			expect(() => {
				registerModule({
					name: "CircularDependencyModule",
					providers: {
						serviceA: {
							provide: TestableBase,
							inject: ["serviceB"],
							useFactory: (serviceB: TestableBase) =>
								new TestableBase({ serviceB }),
						},
						serviceB: {
							provide: TestableBase,
							inject: ["serviceC"],
							useFactory: (serviceC: TestableBase) =>
								new TestableBase({ serviceC }),
						},
						serviceC: {
							provide: TestableBase,
							inject: ["serviceA"],
							useFactory: (serviceA: TestableBase) =>
								new TestableBase({ serviceA }),
						},
					},
				});
			}).toThrow(ERRORS.CircularDependencyError);
		});

		it("should throw an error when modules have circular dependencies", () => {
			const ModuleA: AnyModule = {
				name: "ModuleA",
				imports: [],
			};

			const ModuleB: AnyModule = {
				name: "ModuleB",
				imports: [ModuleA],
			};

			const ModuleC: AnyModule = {
				name: "ModuleC",
				imports: [ModuleB],
			};

			ModuleA.imports = [ModuleB];

			expect(() => {
				registerModule(ModuleC);
			}).toThrow(ERRORS.CircularModuleDependencyError);
		});

		it("should allow circular dependencies within module if provider is lazy", () => {});

		it("should allow circular dependencies with forwardRef", () => {
			interface Circrular {
				call(): void;
				onCall(): string;
			}
			class ServiceA extends TestableBase implements Circrular {
				call() {
					return this.deps.serviceB.onCall();
				}
				onCall() {
					return "Service A called";
				}
			}
			class ServiceB extends TestableBase implements Circrular {
				call() {
					return this.deps.serviceA.onCall();
				}
				onCall() {
					return "Service B called";
				}
			}

			type ModuleADef = ModuleDef<{
				providers: {
					serviceA: ServiceA;
				};
				imports: [ModuleRef<ModuleBDef>];
				exportKeys: ["serviceA"];
			}>;

			const ModuleA = createStaticModule<ModuleADef>({
				name: "ModuleA",
				// import of actual ModuleB into ModuleA is bellow
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
				// ModuleA imports ModuleB via forwardRef, ModuleB imports ModuleA directly
				imports: [typeof ModuleA];
			}>;

			const ModuleB = createStaticModule<ModuleBDef>({
				name: "ModuleB",
				imports: [ModuleA],
				providers: {
					serviceB: ServiceB,
				},
				exports: ["serviceB"],
			});

			ModuleA.imports = [forwardRef(() => ModuleB)];

			// Should not throw with forwardRef
			const { scope, importedScopes } = registerModule(ModuleA);

			const serviceA = scope.resolve("serviceA");
			const serviceB = importedScopes.get("ModuleB")?.scope.resolve("serviceB");
			expect(serviceA?.call()).toBe("Service B called");
			expect(serviceB?.call()).toBe("Service A called");
		});
	});

	describe("Factory Provider Registration", () => {
		it("should register a factory provider without dependencies", () => {
			const { scope } = registerModule({
				providers: {
					factoryService: {
						provide: TestableBase,
						inject: [],
						useFactory: () => new TestableBase(),
					},
				},
			});

			expect(scope.hasRegistration("factoryService")).toBeTruthy();
			expect(scope.resolve("factoryService").getDepKeys().length).toBe(0);
		});

		it("should register a factory provider with dependencies", () => {
			const { scope } = registerModule({
				providers: {
					baseService: TestableBase,
					factoryService: {
						provide: TestableBase,
						inject: ["baseService"],
						useFactory: (baseService: TestableBase) =>
							new TestableBase({ baseService }),
					},
				},
			});

			expect(scope.hasRegistration("factoryService")).toBeTruthy();
			expect(scope.resolve("factoryService").getDepKeys().length).toBe(1);
			expect(scope.resolve("factoryService").getDepKeys()[0]).toBe(
				"baseService",
			);
		});

		it("should register factory providers correctly despite on order of registration", () => {
			const { scope } = registerModule({
				imports: [
					{
						name: "InnerModule",
						providers: {
							p1: class P1 extends TestableBase {},
							innerService: class InnerService extends TestableBase {},
						},
						exports: ["innerService"],
					},
				],
				providers: {
					factoryServiceA: {
						provide: TestableBase,
						inject: ["factoryServiceB", "serviceA", "innerService"],
						useFactory: (
							factoryServiceB: TestableBase,
							serviceA: TestableBase,
							innerService: TestableBase,
						) => new TestableBase({ factoryServiceB, serviceA, innerService }),
					},
					factoryServiceB: {
						provide: TestableBase,
						inject: ["serviceA"],
						useFactory: (serviceA: TestableBase) =>
							new TestableBase({ serviceA }),
					},
					serviceA: class ServiceA extends TestableBase {},
				},
			});

			const serviceA = scope.resolve("serviceA");
			const factoryServiceA = scope.resolve("factoryServiceA");
			const factoryServiceB = scope.resolve("factoryServiceB");

			expect(serviceA.getDepKeys().length).toBe(4);
			expect(serviceA.getDepKeys()).toContain("factoryServiceA");
			expect(serviceA.getDepKeys()).toContain("factoryServiceB");
			expect(serviceA.getDepKeys()).toContain("innerService");

			expect(factoryServiceA.getDepKeys().length).toBe(3);
			expect(factoryServiceA.getDepKeys()).toContain("factoryServiceB");
			expect(factoryServiceA.getDepKeys()).toContain("serviceA");
			expect(factoryServiceA.getDepKeys()).toContain("innerService");
			expect(factoryServiceA.getDeps().innerService.getDepKeys().length).toBe(
				2,
			);
			expect(factoryServiceA.getDeps().innerService.getDepKeys()).toContain(
				"p1",
			);

			expect(factoryServiceB.getDepKeys().length).toBe(1);
			expect(factoryServiceB.getDepKeys()).toContain("serviceA");
		});
	});

	describe("Simple Provider Registration", () => {
		it("should register a ClassConstructor directly with default context settings", () => {
			const { scope } = registerModule({
				providers: {
					directClassService: class DirectClassService extends TestableBase {},
				},
			});

			expect(scope.hasRegistration("directClassService")).toBeTruthy();
			expect(scope.resolve("directClassService").getName()).toBe(
				"DirectClassService",
			);
			expect(scope.registrations.directClassService.lifetime).toBe(
				Lifetime.SINGLETON,
			);
		});

		it("should register a ClassProvider using useClass with provided settings", () => {
			class ServiceWithClassProvider extends TestableBase {}
			const injectorFn = vi.fn(() => ({ injected: true }));

			const { scope } = registerModule({
				providerOptions: {
					lifetime: Lifetime.TRANSIENT,
				},
				providers: {
					classProviderService: {
						injector: injectorFn,
						useClass: ServiceWithClassProvider,
					},
				},
			});

			expect(scope.hasRegistration("classProviderService")).toBeTruthy();
			expect(scope.resolve("classProviderService").getName()).toBe(
				"ServiceWithClassProvider",
			);
			expect(scope.registrations.classProviderService.lifetime).toBe(
				Lifetime.TRANSIENT,
			);
			expect(
				(scope.registrations.classProviderService as BuildResolverOptions<any>)
					.injector,
			).toBe(injectorFn);
		});
	});

	describe("Primitive Provider Registration", () => {
		it("should register string/number primitives as values", () => {
			const { scope } = registerModule({
				providers: {
					apiUrl: "https://api.example.com",
					port: 3000,
					isProduction: true,
					debugMode: false,
					nullValue: null,
					undefinedValue: undefined,
				},
			});

			expect(scope.resolve("port")).toBe(3000);
			expect(scope.resolve("apiUrl")).toBe("https://api.example.com");
			expect(scope.resolve("isProduction")).toBe(true);
			expect(scope.resolve("debugMode")).toBe(false);
			expect(scope.resolve("nullValue")).toBe(null);
			// undefined provider should not be registered
			expect(scope.registrations.undefinedValue).toBeUndefined();
		});

		it("should register primitives alongside class providers", () => {
			const { scope } = registerModule({
				providers: {
					apiUrl: "https://api.example.com",
					port: 8080,
					configService: class ConfigService extends TestableBase {},
				},
			});

			expect(scope.resolve("configService").getDeps().port).toBe(8080);
			expect(scope.resolve("configService").getDeps().apiUrl).toBe(
				"https://api.example.com",
			);
		});
	});

	describe("Module Imports and Exports", () => {
		it("should reuse the same static module scope across repeated imports", () => {
			class SharedSingleton extends TestableBase {}
			class ConsumerA extends TestableBase {}
			class ConsumerB extends TestableBase {}

			const SharedModule: AnyModule = {
				name: "SharedModule",
				providers: {
					sharedSingleton: SharedSingleton,
				},
				exports: ["sharedSingleton"],
			};

			const ModuleA: AnyModule = {
				name: "ModuleA",
				imports: [SharedModule],
				providers: {
					consumerA: ConsumerA,
				},
				exports: ["consumerA"],
			};

			const ModuleB: AnyModule = {
				name: "ModuleB",
				imports: [SharedModule],
				providers: {
					consumerB: ConsumerB,
				},
				exports: ["consumerB"],
			};

			const { scope, importedScopes } = registerModule({
				name: "RootModule",
				imports: [ModuleA, ModuleB],
			});

			const sharedModuleScopeFromA = importedScopes
				.get("ModuleA")
				?.importedScopes.get("SharedModule")?.scope;
			const sharedModuleScopeFromB = importedScopes
				.get("ModuleB")
				?.importedScopes.get("SharedModule")?.scope;

			const sharedFromA = sharedModuleScopeFromA?.resolve("sharedSingleton");
			const sharedFromB = sharedModuleScopeFromB?.resolve("sharedSingleton");

			expect(sharedModuleScopeFromA).toBe(sharedModuleScopeFromB);
			expect(sharedFromA?.instanceId).toBe(sharedFromB?.instanceId);
		});

		it("should exported factory providers to have correct deps", () => {
			class P1 extends TestableBase {}
			class P2 extends TestableBase {}
			class P3 extends TestableBase {}
			class P4 extends TestableBase {}

			const M1: AnyModule = {
				name: "M1",
				providers: {
					p1: P1,
					p3: P3,
				},
				exports: ["p1"],
			};

			const M2: AnyModule = {
				name: "M2",
				imports: [M1],
				providers: {
					p2: {
						provide: P2,
						inject: ["p1"],
						useFactory: (p1: TestableBase) => new P2({ p1 }),
					},
				},
				exports: ["p2"],
			};

			const { scope } = registerModule({
				imports: [M2],
				providers: {
					p4: P4,
				},
			});

			const p2 = scope.resolve("p2");
			const p2Again = scope.resolve("p2");

			expect(p2.getDepKeys()).toContain("p1");
			expect(p2.getDepKeys().length).toBe(1);
			expect(p2.getDeps().p1.getName()).toBe("P1");
			// transient only for wrapper function for exported. Actual lifetime of
			// provider stays correct
			expect(scope.registrations.p2.lifetime).toBe(Lifetime.TRANSIENT);
			expect(p2.instanceId).toBe(p2Again.instanceId);
		});

		it("should make exported providers from imported module available in importing module", () => {
			const exportedModule: AnyModule = {
				name: "ExportedModule",
				imports: [
					{
						name: "AnyModule",
						providers: {
							internalService1: class InternalService1 extends TestableBase {},
						},
						exports: ["internalService1"],
					},
				],
				providers: {
					sharedService: class SharedService extends TestableBase {},
					internalService: class InternalService extends TestableBase {},
				},
				exports: ["sharedService"],
			};

			const { scope, importedScopes } = registerModule({
				imports: [exportedModule],
				providers: {
					localService: class LocalService extends TestableBase {},
				},
			});

			const exportedScope = importedScopes.get("ExportedModule");
			// checks that settings for exported provider are independant of local one
			expect(scope.registrations.sharedService.lifetime).toBe(
				Lifetime.TRANSIENT,
			);
			expect(exportedScope?.scope.registrations.sharedService.lifetime).toBe(
				Lifetime.SINGLETON,
			);

			expect(scope.hasRegistration("sharedService")).toBeTruthy();
			// internal provider is NOT exported and should be unavailable
			expect(scope.hasRegistration("internalService")).toBeFalsy();
			// imports of imported are also should be unavailable
			expect(scope.hasRegistration("internalService1")).toBeFalsy();

			expect(scope.resolve("sharedService").getName()).toBe("SharedService");
			expect(scope.resolve("sharedService").getDepKeys()).toContain(
				"internalService",
			);
			expect(scope.resolve("sharedService").getDepKeys()).toContain(
				"internalService1",
			);
			// imported module scope knowns nothing about it's host
			expect(scope.resolve("sharedService").getDepKeys()).not.toContain(
				"localService",
			);

			expect(scope.resolve("localService").getName()).toBe("LocalService");
			expect(scope.resolve("localService").getDepKeys()).toContain(
				"sharedService",
			);
			expect(scope.resolve("localService").getDepKeys()).not.toContain(
				"internalService",
			);
			expect(scope.resolve("localService").getDepKeys()).not.toContain(
				"internalService1",
			);
		});

		it("should return importScopes map with all imported modules", () => {
			const LoggerModule: AnyModule = {
				name: "LoggerModule",
				providers: {
					loggerService: class Logger extends TestableBase {},
				},
				exports: ["loggerService"],
			};

			const ConfigModule: AnyModule = {
				name: "ConfigModule",
				imports: [LoggerModule],
				providers: {
					configService: class Config extends TestableBase {},
				},
				exports: ["configService"],
			};

			const { importedScopes } = registerModule({
				name: "AppModule",
				imports: [LoggerModule, ConfigModule],
				providers: {
					appService: class AppService extends TestableBase {},
				},
			});

			const loggerModule = importedScopes.get("LoggerModule");
			const configModule = importedScopes.get("ConfigModule");

			expect(loggerModule?.name).toBe("LoggerModule");
			expect(loggerModule?.scope).toBeDefined();
			expect(loggerModule?.scope.hasRegistration("loggerService")).toBe(true);

			expect(configModule?.name).toBe("ConfigModule");
			expect(configModule?.scope).toBeDefined();
			expect(configModule?.importedScopes.has("LoggerModule")).toBe(true);
			expect(configModule?.scope.hasRegistration("configService")).toBe(true);
		});
	});

	describe("Factory Module Registration", () => {
		it("should register a module created via factory function", () => {
			class Service1 extends TestableBase {}

			const DatabaseModule = (config: {
				host: string;
				port: number;
			}): AnyModule => ({
				name: "DatabaseModule",
				providers: {
					host: config.host,
					port: config.port,
					service2: class Service2 extends TestableBase {},
					service1: {
						provide: class Service1 {},
						inject: ["host", "port"],
						useFactory: (host: string, port: number) =>
							new Service1({ host, port }),
					},
				},
			});

			const { scope } = registerModule(
				DatabaseModule({
					host: "localhost",
					port: 5432,
				}),
			);

			expect(scope.resolve("service1").getDeps()).toEqual({
				host: "localhost",
				port: 5432,
			});
			expect(scope.resolve("service2").getDeps().host).toEqual("localhost");
			expect(scope.resolve("service2").getDeps().port).toEqual(5432);
		});

		it("should allow importing a factory module's exports in other modules", () => {
			const LoggerModule = (config: { level: string }): AnyModule => ({
				name: "LoggerModule",
				providers: {
					level: config.level,
					loggerService: class LoggerService extends TestableBase {},
				},
				exports: ["loggerService"],
			});

			const AppModule = (): AnyModule => ({
				name: "AppModule",
				imports: [
					LoggerModule({
						level: "debug",
					}),
				],
				providers: {
					appService: class AppService extends TestableBase {},
				},
			});

			const { scope: appScope } = registerModule(AppModule());

			expect(appScope.resolve("appService").getDepKeys()).toContain(
				"loggerService",
			);
			expect(appScope.resolve("loggerService").getDeps().level).toBe("debug");
		});
	});

	describe("createFactoryProvider Helper", () => {
		it("should create factory provider with createFactoryProvider", () => {
			class ComplexService extends TestableBase {}

			type DepsMap = {
				service1: TestableBase;
				service2: TestableBase;
				appConfig: string;
			};

			const factory = createFactoryProvider<DepsMap>();

			const { scope } = registerModule({
				providers: {
					service1: class Service1 extends TestableBase {},
					service2: class Service2 extends TestableBase {},
					appConfig: "test-config",
					complexService: factory({
						provide: ComplexService,
						inject: ["service1", "service2", "appConfig"],
						useFactory: (service1, service2, appConfig) =>
							new ComplexService({ service1, service2, appConfig }),
					}),
				},
			});

			const complexService = scope.resolve("complexService");

			expect(complexService).toBeInstanceOf(ComplexService);
			expect(complexService.getDeps().service1).toBeInstanceOf(TestableBase);
			expect(complexService.getDeps().service2).toBeInstanceOf(TestableBase);
			expect(complexService.getDeps().appConfig).toBe("test-config");
		});
	});
});
