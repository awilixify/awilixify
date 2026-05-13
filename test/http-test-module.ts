import * as ERRORS from "../lib/di/errors.js";
import type { AnyModule } from "../lib/di/module.types.js";
import { createModule } from "../lib/di/module-factories.js";
import type {
	Initializer,
	InitializerContext,
} from "../lib/di/provider.types.js";
import { runInRequestScopeContext } from "../lib/di/request-scope-context.js";
import {
	HTTP_DECORATOR_STATE_TOKEN,
	rollUpHttpDecoratorState,
} from "../lib/http/decorators.js";
import type { RouteRegistration } from "../lib/http/openapi-builder.js";

type HttpToken = typeof HTTP_DECORATOR_STATE_TOKEN;

class TestHttpInitializer implements Initializer<HttpToken> {
	public readonly token = HTTP_DECORATOR_STATE_TOKEN;
	private readonly app: unknown;
	private readonly beforeRouteRegistered?: (params: RouteRegistration) => any[];

	constructor(
		app: unknown,
		beforeRouteRegistered?: (params: RouteRegistration) => any[],
	) {
		const deps = app as {
			app?: unknown;
			beforeRouteRegistered?: (params: RouteRegistration) => any[];
		};
		this.app = deps?.app ?? app;
		this.beforeRouteRegistered =
			deps?.beforeRouteRegistered ?? beforeRouteRegistered;
	}

	initialize(context: InitializerContext<HttpToken>) {
		const methodState = rollUpHttpDecoratorState(
			context.decoratorState.root,
			context.metadata,
		);

		for (const verb of methodState.verbs) {
			for (const path of methodState.paths) {
				const handler = async (request: unknown, reply: unknown) =>
					runInRequestScopeContext(() => context.invoke(request, reply));

				const beforeMiddleware = this.beforeRouteRegistered?.({
					method: verb,
					path,
					schema: methodState.schema,
				});

				this.registerRoute({
					verb,
					path,
					handler,
					preHandler: [
						...(beforeMiddleware ?? []),
						...methodState.beforeMiddleware,
					],
					schema: methodState.schema,
				});
			}
		}
	}

	private registerRoute(params: {
		verb: string;
		path: string;
		handler: (request: unknown, reply: unknown) => unknown;
		preHandler: any[];
		schema: any;
	}) {
		const framework = this.unwrapFramework(this.app);

		if (this.isFastifyFramework()) {
			(framework as any).route({
				method: params.verb,
				url: params.path,
				handler: params.handler,
				preHandler: params.preHandler,
				schema: params.schema,
			});
			return;
		}

		if (this.isExpressFramework()) {
			const method = params.verb.toLowerCase();
			const handlers = [...params.preHandler];
			handlers.push(async (req: any, res: any, next: any) => {
				try {
					const result = await params.handler(req, res);
					if (result !== undefined && !res.headersSent) {
						res.send(result);
					}
				} catch (error) {
					next(error);
				}
			});

			(framework as any)[method](params.path, ...handlers);
			return;
		}

		throw new ERRORS.UnsupportedFrameworkError();
	}

	private isFastifyFramework(): boolean {
		const framework = this.unwrapFramework(this.app) as object;
		return Object.getOwnPropertySymbols(framework).some((key) =>
			key.toString().includes("fastify"),
		);
	}

	private isExpressFramework(): boolean {
		const framework: any = this.unwrapFramework(this.app);
		return (
			typeof framework === "function" &&
			typeof framework.use === "function" &&
			typeof framework.get === "function" &&
			typeof framework.set === "function"
		);
	}

	private unwrapFramework(value: unknown): unknown {
		let current = value as any;
		let guard = 0;
		while (current && guard < 5) {
			const nested = current?.app;
			if (!nested || nested === current) break;
			current = nested;
			guard += 1;
		}

		return current;
	}
}

export function createHttpTestModule(
	app: unknown,
	beforeRouteRegistered?: (params: RouteRegistration) => any[],
): AnyModule {
	const providers: Record<string, unknown> = {
		app,
		beforeRouteRegistered: beforeRouteRegistered || (() => undefined),
	};

	return createModule({
		name: "HttpTestModule",
		providers,
		initializers: {
			http: TestHttpInitializer,
		},
		initializerExports: ["http"],
	});
}
