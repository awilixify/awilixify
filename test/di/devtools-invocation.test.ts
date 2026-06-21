import { createContainer } from "awilix";
import { describe, expect, it, vi } from "vitest";
import { createDecoratorStateUpdater } from "../../lib/decorators/decorator-state.js";
import {
	AWILIXIFY_DEVTOOLS_PROCESSOR,
	type DevtoolsProcessor,
} from "../../lib/devtools/index.js";
import { DIContext } from "../../lib/di/contexts/di-context.js";
import { InitializerProcessor } from "../../lib/di/processors/initializer-processor.js";
import { InterceptorProcessor } from "../../lib/di/processors/interceptor-processor.js";
import { Initializer } from "../../lib/di/providers/provider.types.js";
import { ProviderResolver } from "../../lib/di/providers/provider-resolver.js";

describe("Devtools invocation", () => {
	it("attaches devtools and invokes graph/provider/handler hooks when present", async () => {
		const devtools = createMockDevtoolsProcessor();

		class Query {
			static readonly key = "get-data";

			async executor(payload: { value: number }) {
				return payload.value + 1;
			}
		}

		class Service {
			getValue() {
				return 42;
			}
		}

		class AuthPreHandler {
			execute() {
				return { auth: true };
			}
		}

		const DevtoolsModule = {
			name: "DevtoolsModule",
			providers: {
				[AWILIXIFY_DEVTOOLS_PROCESSOR]: devtools,
			},
		};
		const AppModule = {
			name: "AppModule",
			providers: {
				service: Service,
			},
			queryPreHandlers: {
				auth: AuthPreHandler,
			},
			queryHandlers: [Query],
		};

		const app = DIContext.create(AppModule, {
			globalModules: [DevtoolsModule],
		});

		expect(devtools.initialize).toHaveBeenCalledWith({
			rootModule: AppModule,
			globalModules: [],
		});
		expect(devtools.graphCollector.registerModule).toHaveBeenCalledWith(
			expect.objectContaining({
				module: AppModule,
				importedModules: [],
			}),
		);
		expect(devtools.tracer.wrapResolver).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "provider",
				providerKey: "service",
				moduleId: "graph-1",
			}),
		);
		expect(devtools.tracer.wrapResolver).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "handler",
				providerKey: "Query",
			}),
		);

		await expect(
			app.scope.resolve<any>("queryMediator").execute("get-data", { value: 1 }),
		).resolves.toBe(2);
		expect(devtools.tracer.recordSpan).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "handler",
				providerKey: "query:get-data",
				methodName: "executor",
			}),
		);
		expect(devtools.tracer.recordSpan).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "prehandler",
				providerKey: "query:prehandler:auth",
				methodName: "execute",
			}),
		);
	});

	it("invokes provider resolver devtools wrapping for provider shapes", () => {
		const devtools = createMockDevtoolsProcessor();
		const scope = createContainer();
		scope.register({
			dep: { resolve: () => 2 },
		});

		class ClassProvider {}
		class UseClassProvider {}
		const module = { name: "ProviderModule" } as any;
		const resolver = new ProviderResolver(undefined, {}, { current: devtools });

		resolver.resolveProvider({
			key: "classProvider",
			moduleId: "module-id",
			module,
			provider: ClassProvider,
			resolutionScope: scope,
		});
		resolver.resolveProvider({
			key: "factoryProvider",
			moduleId: "module-id",
			module,
			provider: {
				inject: ["dep"],
				useFactory: (dep: number) => dep,
			},
			resolutionScope: scope,
		});
		resolver.resolveProvider({
			key: "useClassProvider",
			moduleId: "module-id",
			module,
			provider: {
				useClass: UseClassProvider,
			},
			resolutionScope: scope,
		});

		expect(devtools.tracer.wrapResolver).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "provider",
				providerKey: "classProvider",
				moduleId: "module-id",
			}),
		);
		expect(devtools.tracer.wrapResolver).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "provider",
				providerKey: "factoryProvider",
				isFactory: true,
			}),
		);
		expect(devtools.tracer.wrapResolver).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "provider",
				providerKey: "useClassProvider",
			}),
		);
	});

	it("invokes interceptor devtools spans when interceptor chain runs", () => {
		const devtools = createMockDevtoolsProcessor();
		const processor = new InterceptorProcessor(
			{},
			{
				current: devtools,
			},
		) as any;
		const token = { stateSymbol: Symbol("interceptor") };
		const metadataByToken = new Map([
			[
				token.stateSymbol,
				{ state: { root: null, methods: new Map() }, method: {} },
			],
		]);
		const interceptor = {
			token,
			intercept: vi.fn(({ proceed }) => proceed()),
		};

		const result = processor.callWithInterceptorChain({
			target: {},
			methodName: "run",
			moduleName: "InterceptorModule",
			args: [1],
			metadataByToken,
			interceptors: [interceptor],
			proceed: () => "ok",
		});

		expect(result).toBe("ok");
		expect(devtools.tracer.recordSpan).toHaveBeenCalledWith(
			expect.objectContaining({
				kind: "interceptor",
				moduleName: "InterceptorModule",
				methodName: "run",
			}),
		);
	});

	it("invokes initializer devtools route collection and trace hook", async () => {
		const devtools = createMockDevtoolsProcessor();
		const { token, update } = createDecoratorStateUpdater("test", {
			method: () => ({ enabled: true }),
		});
		const metadataSymbol = getMetadataSymbol();

		class TestController {
			[metadataSymbol] = undefined;

			handle() {
				return "handled";
			}
		}
		(TestController as any)[metadataSymbol] = {};
		update(
			{
				kind: "method",
				name: "handle",
				metadata: (TestController as any)[metadataSymbol],
			} as ClassMethodDecoratorContext,
			{
				method: (state) => state,
			},
		);

		class TestInitializer extends Initializer<typeof token> {
			readonly token = token;

			async initialize(context: any) {
				await context.invoke({ request: true }, { statusCode: 201 });
				await context.invoke({ request: false });
			}
		}

		const scope = createContainer();
		const module = {
			name: "InitializerModule",
			initializers: {
				test: TestInitializer,
			},
		} as any;
		const processor = new InitializerProcessor({ current: devtools });
		const task = processor.collectInitializers(
			module,
			scope,
			[],
			[
				{
					controllerClass: TestController,
					resolve: () => new TestController(),
				},
			],
		);

		expect(devtools.graphCollector.collectModuleRoutes).toHaveBeenCalledWith(
			expect.objectContaining({
				module,
			}),
		);
		await task?.();
		expect(devtools.tracer.traceInitializer).toHaveBeenCalledWith(
			expect.objectContaining({
				args: [{ request: true }, { statusCode: 201 }],
				controllerName: "TestController",
				methodName: "handle",
				moduleName: "InitializerModule",
			}),
		);
		expect(
			devtools.tracer.traceInitializer.mock.calls[0]?.[0].getStatusCode(),
		).toBe(201);
		expect(
			devtools.tracer.traceInitializer.mock.calls[1]?.[0].getStatusCode(),
		).toBeUndefined();
	});
});

function createMockDevtoolsProcessor(): DevtoolsProcessor {
	const tracer = {
		recordSpan: vi.fn((input) => input.callback()),
		traceInitializer: vi.fn((input) => input.callback()),
		wrapResolver: vi.fn((input) => input.resolver),
	};

	return {
		graphCollector: {
			registerModule: vi.fn(() => "graph-1"),
			collectModuleRoutes: vi.fn(),
		},
		tracer,
		initialize: vi.fn(),
	};
}

function getMetadataSymbol(): symbol {
	return Symbol.metadata ?? Symbol.for("Symbol.metadata");
}
