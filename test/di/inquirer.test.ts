import { InjectionMode, Lifetime } from "awilix";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
	AsyncDIContext,
	DIContext,
	type InquirerContext,
} from "../../index.js";
import { InquirerRequiresTransientLifetimeError } from "../../lib/di/errors.js";
import { InquirerResolverFactory } from "../../lib/di/providers/inquirer-resolver-factory.js";

describe("inquirer injection", () => {
	const constructed = vi.fn();

	class Logger {
		constructor(public readonly inquirer: InquirerContext) {
			constructed();
		}
	}
	class FirstService {
		constructor(public readonly logger: Logger) {}
	}
	class SecondService {
		constructor(public readonly logger: Logger) {}
	}

	const loggerProvider = {
		useClass: Logger,
		injectInquirer: true,
		lifetime: Lifetime.TRANSIENT,
	};
	const loggingModule = {
		name: "Logging",
		providers: { logger: loggerProvider },
		exports: ["logger"],
	};

	beforeEach(() => {
		constructed.mockClear();
	});

	it("skips withConsumer when no provider enables inquirer injection", () => {
		const withConsumer = vi.spyOn(
			InquirerResolverFactory.prototype as unknown as {
				withConsumer(
					consumer: InquirerContext,
					resolve: () => unknown,
				): unknown;
			},
			"withConsumer",
		);

		try {
			class Dependency {}
			class Service {
				constructor(public readonly dependency: Dependency) {}
			}
			const { scope } = DIContext.create({
				name: "App",
				providers: { dependency: Dependency, service: Service },
			});
			expect(scope.resolve<Service>("service").dependency).toBeInstanceOf(
				Dependency,
			);
			expect(withConsumer).not.toHaveBeenCalled();
		} finally {
			withConsumer.mockRestore();
		}
	});

	it("creates loggers lazily for each immediate consumer", () => {
		class Parent {
			constructor(public readonly firstService: FirstService) {}
		}
		const { scope } = DIContext.create({
			name: "App",
			providers: {
				logger: loggerProvider,
				firstService: FirstService,
				secondService: SecondService,
				parent: Parent,
			},
		});
		expect(constructed).not.toHaveBeenCalled();

		const first = scope.resolve<Parent>("parent").firstService;
		expect(first.logger.inquirer).toBe(FirstService.prototype);
		expect(scope.resolve("firstService")).toBe(first);
		expect(constructed).toHaveBeenCalledTimes(1);

		const second = scope.resolve<SecondService>("secondService");
		expect(second.logger.inquirer).toBe(SecondService.prototype);
		expect(second.logger).not.toBe(first.logger);

		const direct = scope.resolve<Logger>("logger");
		expect(direct.inquirer).toBeUndefined();
		expect(scope.resolve("logger")).not.toBe(direct);
	});

	it("creates a fresh logger for each transient consumer", () => {
		const { scope } = DIContext.create({
			name: "App",
			providers: {
				logger: loggerProvider,
				firstService: { useClass: FirstService, lifetime: Lifetime.TRANSIENT },
			},
		});

		const first = scope.resolve<FirstService>("firstService");
		const second = scope.resolve<FirstService>("firstService");

		expect(second.logger).not.toBe(first.logger);
		expect(second.logger.inquirer).toBe(FirstService.prototype);
	});

	it.each([
		"imported",
		"global",
	])("preserves the consumer with a %s logger", async (kind) => {
		const module = {
			name: "App",
			providers: { firstService: FirstService },
		};
		const app =
			kind === "imported"
				? DIContext.create({ ...module, imports: [loggingModule] })
				: await AsyncDIContext.create(module, {
						globalModules: [loggingModule],
					});

		expect(
			app.scope.resolve<FirstService>("firstService").logger.inquirer,
		).toBe(FirstService.prototype);
	});

	it("requires a transient lifetime", () => {
		expect(() =>
			DIContext.create({
				name: "App",
				providers: { logger: { useClass: Logger, injectInquirer: true } },
			}),
		).toThrow(InquirerRequiresTransientLifetimeError);
	});

	it("restores the frame after failed construction", () => {
		class Broken {
			constructor(public readonly logger: Logger) {
				throw new Error("broken");
			}
		}
		const { scope } = DIContext.create({
			name: "App",
			providers: { logger: loggerProvider, broken: Broken },
		});
		expect(() => scope.resolve("broken")).toThrow("broken");
		expect(scope.resolve<Logger>("logger").inquirer).toBeUndefined();
	});

	it("preserves custom injector locals", () => {
		class CustomLogger {
			constructor(
				public readonly inquirer: InquirerContext,
				public readonly prefix: string,
			) {}
		}
		class Service {
			constructor(public readonly logger: CustomLogger) {}
		}
		const { scope } = DIContext.create({
			name: "App",
			providers: {
				logger: {
					...loggerProvider,
					useClass: CustomLogger,
					injector: () => ({ prefix: "custom" }),
				},
				service: Service,
			},
		});
		const instance = scope.resolve<Service>("service");
		expect(instance.logger.inquirer).toBe(Service.prototype);
		expect(instance.logger.prefix).toBe("custom");
	});

	it("leaves ordinary inquirer dependencies unchanged without opt-in", () => {
		class Service {
			constructor(public readonly inquirer: string) {}
		}
		const { scope } = DIContext.create({
			name: "App",
			providers: {
				logger: loggerProvider,
				inquirer: "ordinary dependency",
				service: Service,
			},
		});
		expect(scope.resolve<Service>("service").inquirer).toBe(
			"ordinary dependency",
		);
		expect(scope.resolve<Logger>("logger").inquirer).toBeUndefined();
	});

	it("tracks deferred PROXY dependencies, including custom injectors", () => {
		class ProxyLogger {
			constructor(public readonly deps: { inquirer: InquirerContext }) {}
		}
		class Service {
			constructor(
				public readonly deps: { logger: ProxyLogger; prefix?: string },
			) {}
		}
		const { scope } = DIContext.create({
			name: "App",
			containerOptions: { injectionMode: InjectionMode.PROXY },
			providers: {
				logger: { ...loggerProvider, useClass: ProxyLogger },
				plain: Service,
				custom: { useClass: Service, injector: () => ({ prefix: "custom" }) },
			},
		});
		expect(scope.resolve<Service>("plain").deps.logger.deps.inquirer).toBe(
			Service.prototype,
		);
		const custom = scope.resolve<Service>("custom");
		expect(custom.deps.logger.deps.inquirer).toBe(Service.prototype);
		expect(custom.deps.prefix).toBe("custom");
	});

	it("tracks query handlers", async () => {
		class Query {
			static key = "test-query";
			constructor(public readonly logger: Logger) {}
			executor() {
				return this.logger.inquirer;
			}
		}
		const { scope } = DIContext.create({
			name: "App",
			providers: { logger: loggerProvider },
			queryHandlers: [Query],
		});
		const mediator = scope.resolve<{
			execute(key: string, payload: object): Promise<unknown>;
		}>("queryMediator");
		expect(await mediator.execute(Query.key, {})).toBe(Query.prototype);
	});

	it("tracks scoped controllers and preserves resolveSelf", () => {
		const seen: InquirerContext[] = [];

		class Controller {
			constructor(
				public readonly logger: Logger,
				public readonly resolveSelf: () => Controller,
			) {}
			registerRoutes() {
				seen.push(this.logger.inquirer, this.resolveSelf().logger.inquirer);
			}
		}

		DIContext.create({
			name: "App",
			providers: { logger: loggerProvider },
			controllers: [{ useClass: Controller, lifetime: Lifetime.SCOPED }],
		});
		expect(seen).toEqual([Controller.prototype, Controller.prototype]);
	});
});
