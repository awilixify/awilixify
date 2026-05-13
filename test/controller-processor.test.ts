import { AwilixResolutionError, Lifetime } from "awilix";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DIContext, type DiContextOptions } from "../lib/di/di-context.js";
import * as ERRORS from "../lib/di/errors.js";
import type { AnyModule } from "../lib/di/module.types.js";
import type { Controller } from "../lib/di/provider.types.js";
import { controller, GET, POST, schema } from "../lib/http/decorators.js";
import { createHttpTestModule } from "./http-test-module.js";

describe("ControllerProcessor", () => {
	const createMockExpress = () => {
		const app: any = () => {};
		app.use = vi.fn();
		app.get = vi.fn();
		app.post = vi.fn();
		app.set = vi.fn();

		return app;
	};

	const createMockFastify = () => {
		const app: any = {};
		app.route = vi.fn();
		const fastifySymbol = Symbol.for("fastify.instance");
		app[fastifySymbol] = true;

		return app;
	};

	let mockExpress: ReturnType<typeof createMockExpress>;

	beforeEach(() => {
		mockExpress = createMockExpress();
	});

	const registerModule = (
		module: AnyModule,
		options?: Partial<DiContextOptions> & { framework?: any },
	) => {
		const framework = options?.framework || mockExpress;
		const moduleWithAppProvider: AnyModule = {
			...module,
			providers: {
				app: framework,
				...(module.providers || {}),
			},
		};

		return DIContext.create(moduleWithAppProvider, {
			globalModules: [
				createHttpTestModule(framework, options?.beforeRouteRegistered),
			],
			...options,
		});
	};

	class ControllerBase implements Controller {
		registerRoutes() {}
	}

	class TestController extends ControllerBase {}

	class DecoratedController {
		@GET("/test")
		getTest() {
			return "test";
		}
	}

	describe("Basic Controller Registration", () => {
		it("should register controllers with Express framework", () => {
			class ApiController implements Controller {
				constructor(private readonly app: any) {}

				registerRoutes() {
					this.app.get("/api/users", () => {});
					this.app.post("/api/users", () => {});
				}
			}

			registerModule({
				name: "ApiModule",
				controllers: [ApiController],
			});

			expect(mockExpress.get).toHaveBeenCalledWith(
				"/api/users",
				expect.any(Function),
			);
			expect(mockExpress.post).toHaveBeenCalledWith(
				"/api/users",
				expect.any(Function),
			);
		});

		it("should register decorated controllers with Express framework", () => {
			registerModule({
				name: "TestModule",
				controllers: [DecoratedController],
			});

			expect(mockExpress.get).toHaveBeenCalledWith(
				"/test",
				expect.any(Function),
			);
		});
	});

	describe("Duplicate Controller Detection", () => {
		it("should throw error when module has duplicate controllers in its array", () => {
			expect(() => {
				registerModule({
					name: "DuplicateControllerModule",
					controllers: [TestController, TestController],
				});
			}).toThrow(ERRORS.DuplicateControllersInModuleError);
		});

		it("should throw error when different static modules try to register same controller", () => {
			expect(() => {
				registerModule({
					name: "AppModule",
					imports: [
						{
							name: "Module1",
							controllers: [TestController],
						},
						{
							name: "Module2",
							controllers: [TestController],
						},
					],
				});
			}).toThrow(ERRORS.ControllerAlreadyRegisteredError);
		});

		it("should throw error when multiple module instances with default registerControllers use same controller", () => {
			const DynamicModule = () => ({
				name: "DynamicModule",
				controllers: [TestController],
			});

			expect(() => {
				registerModule({
					name: "AppModule",
					imports: [
						{
							name: "Wrapper1",
							imports: [DynamicModule()],
						},
						{
							name: "Wrapper2",
							imports: [DynamicModule()],
						},
					],
				});
			}).toThrow(ERRORS.ControllerAlreadyRegisteredError);
		});
	});

	describe("Same Module Instance Imported Multiple Times", () => {
		it("should skip register controller when same module instance is imported multiple times", () => {
			const SharedModule = {
				name: "SharedModule",
				controllers: [DecoratedController],
			};

			expect(() => {
				registerModule({
					name: "AppModule",
					imports: [
						{
							name: "FeatureModule1",
							imports: [SharedModule],
						},
						{
							name: "FeatureModule2",
							imports: [SharedModule],
						},
					],
				});
			}).not.toThrow();

			expect(mockExpress.get).toHaveBeenCalledTimes(1);
		});
	});

	describe("Module registerControllers Option", () => {
		it("should skip controller registration when registerControllers is false", () => {
			const DynamicModule = () => ({
				name: "DynamicModule",
				controllers: [DecoratedController],
				registerControllers: false,
			});

			registerModule({
				name: "AppModule",
				imports: [DynamicModule()],
			});

			expect(mockExpress.get).not.toHaveBeenCalled();
		});

		it("should register controllers when registerControllers is true", () => {
			const DynamicModule = () => ({
				name: "DynamicModule",
				controllers: [DecoratedController],
				registerControllers: true,
			});

			registerModule({
				name: "AppModule",
				imports: [DynamicModule()],
			});

			expect(mockExpress.get).toHaveBeenCalledWith(
				"/test",
				expect.any(Function),
			);
		});
	});

	describe("Path Concatenation", () => {
		it("should use controller path when no method path is specified", () => {
			@controller("/api")
			class ControllerPathOnlyController {
				@GET()
				getDefault() {}
			}

			registerModule({
				name: "TestModule",
				controllers: [ControllerPathOnlyController],
			});

			expect(mockExpress.get).toHaveBeenCalledWith(
				"/api/",
				expect.any(Function),
			);
		});

		it("should concatenate controller path with method path", () => {
			@controller("/api")
			class CombinedPathController extends DecoratedController {}

			registerModule({
				name: "TestModule",
				controllers: [CombinedPathController],
			});

			expect(mockExpress.get).toHaveBeenCalledWith(
				"/api/test",
				expect.any(Function),
			);
		});

		it("should handle multiple controller paths with multiple method paths", () => {
			@controller(["/api/v1", "/api/v2"])
			class MultiPathController extends DecoratedController {}

			registerModule({
				name: "TestModule",
				controllers: [MultiPathController],
			});

			// Should create all combinations of controller paths and method paths
			expect(mockExpress.get).toHaveBeenCalledWith(
				"/api/v1/test",
				expect.any(Function),
			);
			expect(mockExpress.get).toHaveBeenCalledWith(
				"/api/v2/test",
				expect.any(Function),
			);
		});
	});

	describe("Handler Method Invocation", () => {
		it("should resolve controller and call method with request and reply", async () => {
			const mockReply = { send: vi.fn() };

			registerModule({
				name: "TestModule",
				controllers: [DecoratedController],
			});

			// Get the registered handler (Express wraps it in middleware)
			const handlerCall = mockExpress.get.mock.calls.find(
				(call) => call[0] === "/test",
			);

			const handler = handlerCall[1];

			// Call the handler (tests line 161: return resolve()[methodName](request, reply))
			await handler({}, mockReply, vi.fn());

			expect(mockReply.send).toHaveBeenCalledWith("test");
		});
	});

	describe("Controller Self-Resolution with Non-Singleton Lifetimes", () => {
		it("should allow SCOPED controller to resolve itself via resolveSelf injector", async () => {
			class SelfResolvingController {
				public instanceId = Math.random();

				constructor(private resolveSelf: () => SelfResolvingController) {}

				@GET("/self-scoped")
				async getSelf() {
					const newInstance = this.resolveSelf();

					return {
						instanceId: newInstance.instanceId,
					};
				}
			}

			registerModule({
				name: "TestModule",
				controllers: [
					{
						useClass: SelfResolvingController,
						lifetime: Lifetime.SCOPED,
					},
				],
			});

			// Get the registered handler
			const handlerCall = mockExpress.get.mock.calls.find(
				(call) => call[0] === "/self-scoped",
			);

			const handler = handlerCall[1];
			const mockReply1 = { send: vi.fn(), headersSent: false };
			const mockReply2 = { send: vi.fn(), headersSent: false };

			// Call the handler (tests line 88-94: resolveSelf injector)
			await handler({}, mockReply1, vi.fn());
			await handler({}, mockReply2, vi.fn());

			const result1 = mockReply1.send.mock.calls[0][0];
			const result2 = mockReply2.send.mock.calls[0][0];

			expect(result1.instanceId).not.toBe(result2.instanceId);
		});

		it("should NOT provide resolveSelf injector for SINGLETON controllers", async () => {
			class SingletonController {
				public instanceId = Math.random();

				constructor(private resolveSelf: () => SingletonController) {}

				@GET("/self-singleton")
				async getSelf() {
					return {
						instanceId: this.resolveSelf().instanceId,
					};
				}
			}

			expect(() => {
				registerModule({
					name: "DuplicateControllerModule",
					controllers: [SingletonController],
				});
			}).toThrow(AwilixResolutionError);
		});
	});

	describe("Express Error Handling", () => {
		it("should pass errors to Express next() middleware when controller throws", async () => {
			const testError = new Error("Test error from controller");

			class ErrorThrowingController {
				@GET("/error")
				async throwError() {
					throw testError;
				}
			}

			registerModule({
				name: "TestModule",
				controllers: [ErrorThrowingController],
			});

			// Get the registered handler
			const handlerCall = mockExpress.get.mock.calls.find(
				(call) => call[0] === "/error",
			);

			const handler = handlerCall[1];
			const mockReply = { send: vi.fn(), headersSent: false };
			const mockNext = vi.fn();

			// Call the handler (tests line 227: next(error))
			await handler({}, mockReply, mockNext);

			// Verify the error was passed to next()
			expect(mockNext).toHaveBeenCalledWith(testError);
			expect(mockNext).toHaveBeenCalledTimes(1);
			// Result should not be sent since an error was thrown
			expect(mockReply.send).not.toHaveBeenCalled();
		});
	});

	describe("Schema Decorator with Fastify", () => {
		it("should register schema with Fastify route", () => {
			const mockFastify = createMockFastify();

			const testSchema = {
				body: {
					type: "object",
					properties: {
						name: { type: "string" },
					},
				},
				response: {
					200: {
						type: "object",
						properties: {
							id: { type: "number" },
						},
					},
				},
			};

			class SchemaController {
				@GET("/users")
				@schema(testSchema)
				getUsers() {
					return { id: 1 };
				}
			}

			registerModule(
				{
					name: "SchemaModule",
					controllers: [SchemaController],
				},
				{ framework: mockFastify },
			);

			expect(mockFastify.route).toHaveBeenCalledWith(
				expect.objectContaining({
					method: "GET",
					url: "/users",
					schema: testSchema,
				}),
			);
		});

		it("should register route with empty schema when schema decorator is not used", () => {
			const mockFastify = createMockFastify();

			class NoSchemaController {
				@GET("/users")
				getUsers() {
					return { id: 1 };
				}
			}

			registerModule(
				{
					name: "NoSchemaModule",
					controllers: [NoSchemaController],
				},
				{ framework: mockFastify },
			);

			const routeCall = mockFastify.route.mock.calls[0][0];
			expect(routeCall.schema).toEqual({});
		});
	});

	describe("beforeRouteRegistered Callback", () => {
		it("should call beforeRouteRegistered with route registration params", () => {
			const beforeRouteRegistered = vi.fn();

			const testSchema = {
				querystring: { type: "object" },
				response: { 200: { type: "object" } },
			};

			class TestController {
				@GET("/api/users")
				@schema(testSchema)
				getUsers() {}

				@POST("/api/user")
				@schema(testSchema)
				createUser() {}
			}

			registerModule(
				{
					name: "TestModule",
					controllers: [TestController],
				},
				{ beforeRouteRegistered },
			);

			expect(beforeRouteRegistered).toHaveBeenCalledTimes(2);
			expect(beforeRouteRegistered).toHaveBeenCalledWith({
				method: "GET",
				path: "/api/users",
				schema: testSchema,
			});
			expect(beforeRouteRegistered).toHaveBeenCalledWith({
				method: "POST",
				path: "/api/user",
				schema: testSchema,
			});
		});

		it("should inject middleware returned from beforeRouteRegistered into Express route", () => {
			const validationMiddleware = vi.fn((_, __, next) => next());
			const loggingMiddleware = vi.fn((_, __, next) => next());

			const beforeRouteRegistered = vi.fn(() => [
				validationMiddleware,
				loggingMiddleware,
			]);

			class TestController {
				@GET("/test")
				getTest() {
					return "test";
				}
			}

			registerModule(
				{
					name: "TestModule",
					controllers: [TestController],
				},
				{ beforeRouteRegistered },
			);

			// Get the registered handler
			const handlerCall = mockExpress.get.mock.calls.find(
				(call: any) => call[0] === "/test",
			);

			// Express registers: [validationMiddleware, loggingMiddleware, wrappedHandler]
			// The handler at position 1 should be our first middleware
			const registeredHandler = handlerCall[1];

			// Call the first registered handler (should be validation middleware)
			const mockNext = vi.fn();
			registeredHandler({}, {}, mockNext);

			expect(validationMiddleware).toHaveBeenCalledTimes(1);
			expect(mockNext).toHaveBeenCalledTimes(1);
		});
	});
});
