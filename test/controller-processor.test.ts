import { AwilixResolutionError, Lifetime } from "awilix";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DIContext } from "../lib/di/contexts/di-context.js";
import * as ERRORS from "../lib/di/errors.js";
import type { AnyModule } from "../lib/di/modules/module.types.js";
import type { Controller } from "../lib/di/providers/provider.types.js";
import { GET } from "../lib/http/decorators.js";
import { createHttpTestModule, createMockExpress } from "./http-test-module.js";

describe("ControllerProcessor", () => {
	let mockExpress: ReturnType<typeof createMockExpress>;

	beforeEach(() => {
		mockExpress = createMockExpress();
	});

	const registerModule = (module: AnyModule) => {
		return DIContext.create(module, {
			globalModules: [createHttpTestModule(mockExpress)],
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
		it("should skip register controller when same module instance is imported multiple times", async () => {
			const SharedModule = {
				name: "SharedModule",
				controllers: [DecoratedController],
			};

			let app: ReturnType<typeof registerModule> | undefined;

			expect(() => {
				app = registerModule({
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

			await app?.init();

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

		it("should register controllers when registerControllers is true", async () => {
			const DynamicModule = () => ({
				name: "DynamicModule",
				controllers: [DecoratedController],
				registerControllers: true,
			});

			const app = registerModule({
				name: "AppModule",
				imports: [DynamicModule()],
			});
			await app.init();

			expect(mockExpress.get).toHaveBeenCalledWith(
				"/test",
				expect.any(Function),
			);
		});
	});

	describe("Handler Method Invocation", () => {
		it("should resolve controller and call method with request and reply", async () => {
			const mockReply = { send: vi.fn() };

			const app = registerModule({
				name: "TestModule",
				controllers: [DecoratedController],
			});
			await app.init();

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

			const app = registerModule({
				name: "TestModule",
				controllers: [
					{
						useClass: SelfResolvingController,
						lifetime: Lifetime.SCOPED,
					},
				],
			});
			await app.init();

			// Get the registered handler
			const handlerCall = mockExpress.get.mock.calls.find(
				(call) => call[0] === "/self-scoped",
			);

			const handler = handlerCall[1];
			const mockReply1 = { send: vi.fn(), headersSent: false };
			const mockReply2 = { send: vi.fn(), headersSent: false };

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
});
