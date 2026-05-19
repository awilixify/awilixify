import { beforeEach, describe, expect, it } from "vitest";

import { createDecoratorStateUpdater } from "../../lib/decorators/decorator-state.js";
import { DIContext } from "../../lib/di/contexts/di-context.js";
import * as ERRORS from "../../lib/di/errors.js";
import type { AnyModule } from "../../lib/di/modules/module.types.js";
import { createModule } from "../../lib/di/modules/module-factories.js";
import {
	Initializer,
	type InitializerContext,
	type InterceptContext,
	type Interceptor,
	type MetadataInitializerContext,
} from "../../lib/di/providers/provider.types.js";
import {
	createHttpTestModule,
	createMockExpress,
} from "../http/http-test-module.js";

describe("Controller initializers", () => {
	let mockExpress: ReturnType<typeof createMockExpress>;
	let methodCalls: Array<string | symbol>;
	let invokeCalls: string[];

	const { token: META_TOKEN, update: markMeta } = createDecoratorStateUpdater(
		"controller-meta-initializer",
		{
			method: () => ({ enabled: true }),
		},
	);
	const { token: EXEC_TOKEN, update: markExec } = createDecoratorStateUpdater(
		"controller-exec-initializer",
		{
			method: () => ({ enabled: true }),
		},
	);
	const { token: ALT_EXEC_TOKEN, update: markAltExec } =
		createDecoratorStateUpdater("controller-alt-exec-initializer", {
			method: () => ({ enabled: true }),
		});

	beforeEach(() => {
		mockExpress = createMockExpress();
		methodCalls = [];
		invokeCalls = [];
	});

	const registerModule = (module: AnyModule) => {
		return DIContext.create(module, {
			globalModules: [createHttpTestModule(mockExpress)],
		});
	};

	class MetadataInitializer extends Initializer<typeof META_TOKEN, false> {
		readonly token = META_TOKEN;
		readonly usesInvoke = false;

		initialize(context: MetadataInitializerContext<typeof META_TOKEN>) {
			expect("invoke" in context).toBe(false);
			methodCalls.push(context.methodName);
			invokeCalls.push(`meta:${String(context.methodName)}`);
		}
	}

	class ExecInitializer extends Initializer<typeof EXEC_TOKEN> {
		readonly token = EXEC_TOKEN;

		initialize(context: InitializerContext<typeof EXEC_TOKEN>) {
			invokeCalls.push(`invoke:${String(context.methodName)}`);
			context.invoke();
		}
	}

	class AltExecInitializer extends Initializer<typeof ALT_EXEC_TOKEN> {
		readonly token = ALT_EXEC_TOKEN;

		initialize(_context: InitializerContext<typeof ALT_EXEC_TOKEN>) {}
	}

	function withMetaMetadata() {
		return (target: any, context: ClassMethodDecoratorContext) => {
			markMeta(context, { method: () => ({ enabled: true }) });
			return target;
		};
	}

	function withExecMetadata() {
		return (target: any, context: ClassMethodDecoratorContext) => {
			markExec(context, { method: () => ({ enabled: true }) });
			return target;
		};
	}

	function withAltExecMetadata() {
		return (target: any, context: ClassMethodDecoratorContext) => {
			markAltExec(context, { method: () => ({ enabled: true }) });
			return target;
		};
	}

	it("should run local initializers for decorated controller methods", async () => {
		class LocalDecoratedController {
			@withMetaMetadata()
			handler() {
				return "ok";
			}

			plain() {
				return "plain";
			}
		}

		const app = registerModule({
			name: "AppModule",
			controllers: [LocalDecoratedController],
			initializers: {
				local: MetadataInitializer,
			},
		});

		await app.init();

		expect(methodCalls).toEqual(["handler"]);
	});

	it("should run initializers only for decorated controller methods", async () => {
		class DecoratedProvider {
			@withMetaMetadata()
			providerHandler() {
				return "provider";
			}
		}

		class DecoratedController {
			@withMetaMetadata()
			controllerHandler() {
				return "controller";
			}
		}

		const app = registerModule({
			name: "AppModule",
			controllers: [DecoratedController],
			providers: {
				provider: DecoratedProvider,
			},
			initializers: {
				local: MetadataInitializer,
			},
		});

		await app.init();

		expect(methodCalls).toEqual(["controllerHandler"]);
	});

	it("should allow one invoke-enabled initializer and additional metadata-only initializers on the same method", async () => {
		class LocalDecoratedController {
			@withMetaMetadata()
			@withExecMetadata()
			handler() {
				invokeCalls.push("handler");
				return "ok";
			}
		}

		const app = registerModule({
			name: "AppModule",
			controllers: [LocalDecoratedController],
			initializers: {
				meta: MetadataInitializer,
				exec: ExecInitializer,
			},
		});

		await app.init();

		expect(invokeCalls).toEqual(["meta:handler", "invoke:handler", "handler"]);
	});

	it("should run controller initializers through controller interceptors", async () => {
		const { token: interceptToken, update: markIntercept } =
			createDecoratorStateUpdater("controller-interceptor-with-initializer", {
				method: () => ({ enabled: true }),
			});

		class TestInterceptor implements Interceptor<typeof interceptToken> {
			readonly token = interceptToken;

			intercept(context: InterceptContext<typeof interceptToken>) {
				invokeCalls.push(`intercept:${String(context.methodName)}`);
				return context.proceed();
			}
		}

		function withInterceptMetadata() {
			return (target: any, context: ClassMethodDecoratorContext) => {
				markIntercept(context, { method: () => ({ enabled: true }) });
				return target;
			};
		}

		class LocalDecoratedController {
			@withExecMetadata()
			@withInterceptMetadata()
			handler() {
				invokeCalls.push("handler");
				return "ok";
			}
		}

		const app = registerModule({
			name: "AppModule",
			controllers: [LocalDecoratedController],
			initializers: {
				exec: ExecInitializer,
			},
			interceptors: {
				test: TestInterceptor,
			},
		});

		await app.init();

		expect(invokeCalls).toEqual([
			"invoke:handler",
			"intercept:handler",
			"handler",
		]);
	});

	it("should pass complete initializer context", async () => {
		const metadata = { role: "admin", enabled: true };
		const { token: contextToken, update: markContext } =
			createDecoratorStateUpdater("controller-initializer-context", {
				method: () => metadata,
			});
		let capturedContext: InitializerContext<typeof contextToken> | undefined;

		class ContextInitializer extends Initializer<typeof contextToken> {
			readonly token = contextToken;

			initialize(context: InitializerContext<typeof contextToken>) {
				capturedContext = context;
			}
		}

		function withContextMetadata() {
			return (target: any, context: ClassMethodDecoratorContext) => {
				markContext(context, { method: () => metadata });
				return target;
			};
		}

		class ContextController {
			@withContextMetadata()
			handler(value: string) {
				return `handled:${value}`;
			}
		}

		const app = registerModule({
			name: "AppModule",
			controllers: [ContextController],
			initializers: {
				context: ContextInitializer,
			},
		});

		await app.init();

		expect(capturedContext?.moduleName).toBe("AppModule");
		expect(capturedContext?.target).toBe(ContextController);
		expect(capturedContext?.methodName).toBe("handler");
		expect(capturedContext?.metadata).toEqual(metadata);
		expect(capturedContext?.decoratorState.methods.get("handler")).toEqual(
			metadata,
		);
		expect(capturedContext?.invoke("value")).toBe("handled:value");
	});

	it("should throw when an exported initializer key has no provider definition", () => {
		expect(() =>
			registerModule({
				name: "AppModule",
				imports: [
					{
						name: "BrokenInitializers",
						initializerExports: ["missing"],
					},
				],
			}),
		).toThrow(ERRORS.InvalidProviderDefinitionError);
	});

	it("should throw when two initializers with same token enter the same module scope", () => {
		class DuplicateAwareInitializer extends Initializer<
			typeof META_TOKEN,
			false
		> {
			readonly token = META_TOKEN;
			readonly usesInvoke = false;

			initialize() {}
		}

		const InitializerModuleA = {
			name: "InitializerModuleA",
			initializers: {
				first: DuplicateAwareInitializer,
			},
			initializerExports: ["first"],
		};

		const InitializerModuleB = {
			name: "InitializerModuleB",
			initializers: {
				second: DuplicateAwareInitializer,
			},
			initializerExports: ["second"],
		};

		expect(() =>
			registerModule({
				name: "AppModule",
				imports: [InitializerModuleA, InitializerModuleB],
			}),
		).toThrow(ERRORS.DuplicateInitializerTokenError);
	});

	it("should throw when multiple invoke-enabled initializers on same method", async () => {
		class LocalDecoratedController {
			@withExecMetadata()
			@withAltExecMetadata()
			handler() {
				return "ok";
			}
		}

		const app = registerModule({
			name: "AppModule",
			controllers: [LocalDecoratedController],
			initializers: {
				first: ExecInitializer,
				second: AltExecInitializer,
			},
		});

		await expect(app.init()).rejects.toThrow(
			ERRORS.MultipleInvokeInitializersPerMethodError,
		);
	});

	describe("order", () => {
		function createOrderedInitializer(label: string) {
			const { token: initializerToken, update } = createDecoratorStateUpdater(
				label,
				{
					method: () => ({ enabled: true }),
				},
			);

			class OrderedInitializer extends Initializer<
				typeof initializerToken,
				false
			> {
				readonly token = initializerToken;
				readonly usesInvoke = false;

				initialize(
					_context: MetadataInitializerContext<typeof initializerToken>,
				) {
					invokeCalls.push(label);
				}
			}

			function decorate() {
				return (target: any, context: ClassMethodDecoratorContext) => {
					update(context, { method: () => ({ enabled: true }) });

					return target;
				};
			}

			return { decorate, OrderedInitializer };
		}

		it("should run global initializers first, then imported initializers, then local initializers", async () => {
			const globalA = createOrderedInitializer("global-a");
			const globalB = createOrderedInitializer("global-b");
			const importedA = createOrderedInitializer("imported-a");
			const importedB = createOrderedInitializer("imported-b");
			const importedC = createOrderedInitializer("imported-c");
			const local = createOrderedInitializer("local");

			const GlobalModuleA = createModule({
				name: "GlobalModuleA",
				initializers: {
					globalA: globalA.OrderedInitializer,
				} as any,
				initializerExports: ["globalA"] as any,
			});

			const GlobalModuleB = createModule({
				name: "GlobalModuleB",
				initializers: {
					globalB: globalB.OrderedInitializer,
				} as any,
				initializerExports: ["globalB"] as any,
			});

			const ImportedModuleA = createModule({
				name: "ImportedModuleA",
				initializers: {
					importedA: importedA.OrderedInitializer,
				} as any,
				initializerExports: ["importedA"] as any,
			});

			const ImportedModuleB = createModule({
				name: "ImportedModuleB",
				initializers: {
					importedB: importedB.OrderedInitializer,
					importedC: importedC.OrderedInitializer,
				} as any,
				initializerExports: ["importedB", "importedC"] as any,
			});

			class OrderedController {
				@importedC.decorate()
				@importedB.decorate()
				@globalA.decorate()
				@local.decorate()
				@importedA.decorate()
				@globalB.decorate()
				handler() {
					return "ok";
				}
			}

			const app = DIContext.create(
				{
					name: "AppModule",
					imports: [ImportedModuleA, ImportedModuleB] as any,
					controllers: [OrderedController],
					initializers: {
						local: local.OrderedInitializer,
					} as any,
				},
				{
					globalModules: [GlobalModuleA, GlobalModuleB],
				},
			);

			await app.init();

			expect(invokeCalls).toEqual([
				"global-a",
				"global-b",
				"imported-a",
				"imported-b",
				"imported-c",
				"local",
			]);
		});
	});
});
