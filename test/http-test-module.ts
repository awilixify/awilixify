import { HTTP_INITIALIZER_TOKEN } from "../lib/decorators/http-initializer.js";
import {
	getClassHttpDecoratorState,
	type IHttpDecoratorState,
} from "../lib/decorators/http-state.js";
import * as ERRORS from "../lib/di/errors.js";
import { createStaticModule } from "../lib/di/module-factories.js";
import { runInRequestScopeContext } from "../lib/di/request-scope-context.js";
import type { AnyModule } from "../lib/di/module.types.js";
import type { Initializer, InitializerContext } from "../lib/di/provider.types.js";
import type { RouteRegistration } from "../lib/http/openapi-builder.js";

class TestHttpInitializer implements Initializer<true> {
	public readonly token = HTTP_INITIALIZER_TOKEN;
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

	initialize(context: InitializerContext<true>) {
		const state = getClassHttpDecoratorState(context.controllerClass);
		if (!state) return;

		const methodState = this.rollUpDecoratedState(state).get(context.methodName);
		if (!methodState) return;

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

	private rollUpDecoratedState(
		state: IHttpDecoratorState,
	): IHttpDecoratorState["methods"] {
		const result: IHttpDecoratorState["methods"] = new Map();

		state.methods.forEach((method, key) => {
			result.set(key, {
				paths: this.concatPaths(state.root.paths, method.paths),
				beforeMiddleware: [
					...state.root.beforeMiddleware,
					...method.beforeMiddleware,
				],
				afterMiddleware: [
					...method.afterMiddleware,
					...state.root.afterMiddleware,
				],
				verbs: method.verbs,
				schema: method.schema,
			});
		});

		return result;
	}

	private concatPaths(rootPaths: string[], methodPaths: string[]): string[] {
		if (rootPaths.length === 0) return [...methodPaths];
		const result: string[] = [];
		rootPaths.forEach((rootPath) => {
			methodPaths.forEach((methodPath) => {
				result.push(rootPath + methodPath);
			});
		});

		return result;
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

	return createStaticModule({
		name: "HttpTestModule",
		providers,
		initializers: {
			http: TestHttpInitializer,
		},
		initializerExports: ["http"],
	});
}
