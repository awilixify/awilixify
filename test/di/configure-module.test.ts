import { describe, expect, it, vi } from "vitest";
import {
	type AnyModule,
	configureModule,
	createModule,
	DIContext,
	forwardRef,
	type ModuleDef,
	overrideModule,
} from "../../index.js";
import * as ERRORS from "../../lib/di/errors.js";

function fixture(calls: string[]) {
	class ConfigService {
		host = "broker:5672";
		constructor() {
			calls.push("config.constructor");
		}
		async onInit() {
			calls.push("config.onInit");
		}
		afterInit() {
			calls.push("config.afterInit");
		}
	}

	type ConfigDef = ModuleDef<{
		providers: { config: ConfigService };
		exportKeys: ["config"];
	}>;
	const configModule = createModule<ConfigDef>({
		name: "Config",
		providers: { config: { useClass: ConfigService, eager: true } },
		exports: ["config"],
	});

	const factory = vi.fn((config: ConfigService) => {
		calls.push("factory");

		return {
			name: "Messaging",
			providers: { host: config.host },
			exports: ["host"],
		};
	});

	const messaging = configureModule({
		imports: [configModule],
		inject: ["config"],
		useFactory: factory,
	});

	return { configModule, messaging, factory };
}

describe("synchronous configureModule with DIContext", () => {
	it("rejects configured roots before running their factories", () => {
		const factory = vi.fn(() => ({ name: "Root" }));
		const configured = configureModule({
			imports: [],
			inject: [],
			useFactory: factory,
		});
		expect(() => DIContext.create(configured)).toThrow(
			ERRORS.ConfiguredModuleAsRootError,
		);
		expect(factory).not.toHaveBeenCalled();
	});

	it("propagates constructor validation and factory failures during create", () => {
		const error = new Error("Invalid environment");
		const factory = vi.fn(() => ({ name: "Configured" }));
		class InvalidConfig {
			constructor() {
				throw error;
			}
		}
		type ConfigDef = ModuleDef<{
			providers: { config: InvalidConfig };
			exportKeys: ["config"];
		}>;
		const config = createModule<ConfigDef>({
			name: "Config",
			providers: { config: InvalidConfig },
			exports: ["config"],
		});

		expect(() =>
			DIContext.create({
				name: "App",
				imports: [
					configureModule({
						imports: [config],
						inject: ["config"],
						useFactory: factory,
					}),
				],
			}),
		).toThrow(error);
		expect(factory).not.toHaveBeenCalled();

		expect(() =>
			DIContext.create({
				name: "App",
				imports: [
					configureModule({
						imports: [],
						inject: [],
						useFactory: () => {
							throw error;
						},
					}),
				],
			}),
		).toThrow(error);
	});

	it("validates final module names and exports during create", () => {
		const make = () =>
			configureModule({
				imports: [],
				inject: [],
				useFactory: () => ({ name: "SameName" }),
			});

		expect(() =>
			DIContext.create({ name: "App", imports: [make(), make()] }),
		).toThrow("SameName");

		const configured = configureModule({
			imports: [],
			inject: [],
			useFactory: () => ({
				name: "Configured",
				providers: { answer: 42 },
				exports: ["answer"],
			}),
		});

		expect(() =>
			DIContext.create({
				name: "App",
				imports: [configured],
				providers: { answer: 1 },
			}),
		).toThrow("answer");

		expect(() =>
			DIContext.create({ name: "App" }, { globalModules: [make(), make()] }),
		).toThrow("SameName");
	});

	it("rejects configuration cycles but allows ordinary forward-reference cycles", async () => {
		const dependency: AnyModule = {
			name: "Dependency",
			imports: [forwardRef(() => configured)],
		};
		const configured = configureModule({
			imports: [dependency],
			inject: [],
			useFactory: () => ({ name: "Configured" }),
		});

		expect(() =>
			DIContext.create({ name: "App", imports: [configured] }),
		).toThrow(ERRORS.CircularModuleConfigurationDependencyError);

		const one: AnyModule = { name: "One" };
		const two = { name: "Two", imports: [forwardRef(() => one)] };
		one.imports = [two];

		const context = DIContext.create({
			name: "App",
			imports: [
				configureModule({
					imports: [one],
					inject: [],
					useFactory: () => ({ name: "Configured" }),
				}),
			],
		});
		await context.close();
	});

	it("rejects invalid factory results with the descriptor name", () => {
		const configured = configureModule({
			imports: [],
			inject: [],
			// @ts-expect-error Factories must return a module.
			useFactory: () => null,
		});

		expect(() =>
			DIContext.create({ name: "App", imports: [configured] }),
		).toThrow(
			expect.objectContaining({
				name: "InvalidModuleConfigurationFactoryResultError",
				message: expect.stringContaining(configured.name),
			}),
		);

		expect(() =>
			DIContext.create({ name: "App", imports: [configured] }),
		).toThrow(ERRORS.InvalidModuleConfigurationFactoryResultError);
	});

	it("validates injected exports and rejects async factories at runtime", () => {
		expect(() =>
			DIContext.create({
				name: "App",
				imports: [
					configureModule({
						imports: [],
						// @ts-expect-error No imports export this key.
						inject: ["missing"],
						useFactory: () => ({ name: "Configured" }),
					}),
				],
			}),
		).toThrow(ERRORS.ModuleConfigurationDependencyNotFoundError);

		expect(() =>
			DIContext.create({
				name: "App",
				imports: [
					configureModule({
						imports: [],
						inject: [],
						// @ts-expect-error Async configuration is not supported.
						useFactory: async () => ({ name: "Async" }),
					}),
				],
			}),
		).toThrow(ERRORS.AsyncModuleConfigurationFactoryError);
	});

	it("configures during create, shares dependencies, and leaves lifecycle hooks to init", async () => {
		const calls: string[] = [];
		const { configModule, messaging, factory } = fixture(calls);
		const context = DIContext.create({
			name: "App",
			imports: [configModule, messaging],
		});

		expect(context.scope.resolve("host")).toBe("broker:5672");
		expect(calls).toEqual(["config.constructor", "factory"]);
		expect(factory.mock.calls[0]?.[0]).toBe(
			context.importedScopes.get("Config")?.scope.resolve("config"),
		);
		await Promise.all([context.init(), context.init()]);
		expect(calls).toEqual([
			"config.constructor",
			"factory",
			"config.onInit",
			"config.afterInit",
		]);
		expect(factory).toHaveBeenCalledOnce();
		await context.close();
	});

	it("supports nested configuration", async () => {
		type ValueDef = ModuleDef<{
			providers: { value: number };
			exportKeys: ["value"];
		}>;
		const inner = configureModule({
			imports: [],
			inject: [],
			useFactory: () =>
				createModule<ValueDef>({
					name: "Inner",
					providers: { value: 42 },
					exports: ["value"],
				}),
		});
		const context = DIContext.create({
			name: "App",
			imports: [
				configureModule({
					imports: [inner],
					inject: ["value"],
					useFactory: (value) => ({
						name: "Configured",
						providers: { answer: value },
						exports: ["answer"],
					}),
				}),
			],
		});

		expect(context.name).toBe("App");
		expect(context.scope.resolve("answer")).toBe(42);
		await context.close();
	});

	it("shares a descriptor across importers but not contexts", async () => {
		const factory = vi.fn(() => ({ name: "Configured" }));
		const configured = configureModule({
			imports: [],
			inject: [],
			useFactory: factory,
		});
		const root = {
			name: "App",
			imports: [
				{ name: "One", imports: [configured] },
				{ name: "Two", imports: [configured] },
			],
		};
		const first = DIContext.create(root);
		expect(factory).toHaveBeenCalledOnce();
		const second = DIContext.create(root);
		expect(factory).toHaveBeenCalledTimes(2);
		await first.close();
		await second.close();
	});

	it("registers returned module eager providers for normal lifecycle initialization", async () => {
		const onInit = vi.fn();
		const context = DIContext.create({
			name: "App",
			imports: [
				configureModule({
					imports: [],
					inject: [],
					useFactory: () => ({
						name: "Configured",
						providers: {
							service: { eager: true, useFactory: () => ({ onInit }) },
						},
					}),
				}),
			],
		});

		expect(onInit).not.toHaveBeenCalled();
		await context.init();
		expect(onInit).toHaveBeenCalledOnce();
		await context.close();
	});

	it("applies overrides to configuration dependencies and returned modules", async () => {
		const calls: string[] = [];
		const { configModule } = fixture(calls);
		const replacement = {
			host: "overridden",
			onInit: vi.fn(async () => {}),
			afterInit: vi.fn(),
		};
		type TargetDef = ModuleDef<{
			providers: { endpoint: string };
			exportKeys: ["endpoint"];
		}>;
		const target = createModule<TargetDef>({
			name: "Target",
			providers: { endpoint: "default" },
			exports: ["endpoint"],
		});
		const factory = vi.fn(() => target);
		const context = DIContext.create(
			{
				name: "App",
				imports: [
					configureModule({
						imports: [configModule],
						inject: ["config"],
						useFactory: factory,
					}),
				],
			},
			{
				moduleOverrides: [
					overrideModule(configModule, {
						providers: {
							config: { eager: true, useFactory: () => replacement },
						},
					}),
					overrideModule(target, { providers: { endpoint: "override" } }),
				],
			},
		);
		expect(calls).toEqual([]);
		expect(factory.mock.calls[0]).toEqual([replacement]);
		expect(context.scope.resolve("endpoint")).toBe("override");
		await context.init();
		expect(replacement.onInit).toHaveBeenCalledOnce();
		expect(calls).toEqual([]);
		await context.close();
	});

	it("wires configured globals into ordinary modules", async () => {
		class Consumer {
			constructor(public answer: number) {}
		}
		const global = configureModule({
			imports: [],
			inject: [],
			useFactory: () => ({
				name: "Global",
				providers: { answer: 42 },
				exports: ["answer"],
			}),
		});
		const context = DIContext.create(
			{
				name: "App",
				imports: [
					{
						name: "Consumer",
						providers: { consumer: Consumer },
						exports: ["consumer"],
					},
				],
			},
			{ globalModules: [global] },
		);
		expect(context.scope.resolve<Consumer>("consumer").answer).toBe(42);
		expect(context.scope.resolve("answer")).toBe(42);
		await context.close();
	});
});
