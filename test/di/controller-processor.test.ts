import { AwilixResolutionError, Lifetime } from "awilix";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DIContext } from "../../lib/di/contexts/di-context.js";
import * as ERRORS from "../../lib/di/errors.js";
import type { AnyModule } from "../../lib/di/modules/module.types.js";
import type { Controller } from "../../lib/di/providers/provider.types.js";
import { GET } from "../../lib/http/decorators.js";
import {
	createHttpTestModule,
	createMockExpress,
} from "../http/http-test-module.js";

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

	class TestController implements Controller {
		registerRoutes() {}
	}

	class DecoratedController {
		@GET("/test")
		getTest() {
			return "test";
		}
	}

	describe("Basic Controller Registration", () => {
		it("should call registerRoutes during controller registration", () => {
			const registerRoutes = vi.fn();

			class ApiController implements Controller {
				registerRoutes() {
					registerRoutes();
				}
			}

			registerModule({
				name: "ApiModule",
				controllers: [ApiController],
			});

			expect(registerRoutes).toHaveBeenCalledTimes(1);
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

		it("should throw error when different modules try to register same controller", () => {
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

	describe("Controller Self-Resolution with Non-Singleton Lifetimes", () => {
		it("should allow SCOPED controller to resolve itself via resolveSelf injector", async () => {
			let capturedResolveSelf: (() => SelfResolvingController) | undefined;

			class SelfResolvingController {
				public instanceId = Math.random();

				constructor(private resolveSelf: () => SelfResolvingController) {}

				// since registerRoutes runs on boostrap, here it serves just to get
				// resolveSelf from container
				registerRoutes() {
					capturedResolveSelf = this.resolveSelf;
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

			const result1 = capturedResolveSelf?.().instanceId;
			const result2 = capturedResolveSelf?.().instanceId;

			expect(result1).not.toBe(result2);
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
