import { createDecoratorStateUpdater } from "../decorators/decorator-state.js";
import type {
	DecoratorState,
	DecoratorToken,
} from "../decorators/decorator-state.types.js";
import { type HttpVerb, HttpVerbs } from "./http-verbs.js";
import type { RouteSchema } from "./openapi-builder.js";

type MiddlewareParameter = any[] | any;
type ControllerOptions = string | string[] | { path: string | string[] };

interface RootState {
	paths: string[];
	beforeMiddleware: any[];
	afterMiddleware: any[];
}

interface MethodState {
	paths: string[];
	beforeMiddleware: any[];
	afterMiddleware: any[];
	verbs: HttpVerb[];
	schema: RouteSchema;
}

export interface HttpDecoratorState
	extends DecoratorState<MethodState, RootState> {}

const { update, token } = createDecoratorStateUpdater("http-decorator-state", {
	method: (): MethodState => ({
		paths: [],
		beforeMiddleware: [],
		afterMiddleware: [],
		verbs: [],
		schema: {},
	}),
	root: (): RootState => ({
		paths: [],
		beforeMiddleware: [],
		afterMiddleware: [],
	}),
});

export const HTTP_DECORATOR_STATE_TOKEN: DecoratorToken<HttpDecoratorState> =
	token;

function createRouteDecorator(httpVerb: HttpVerb) {
	return (path = "/") =>
		(target: any, context: ClassMethodDecoratorContext) => {
			update(context, {
				method: (previous) => {
					return {
						...previous,
						verbs: uniq([...previous.verbs, httpVerb]),
						paths: uniq([...previous.paths, path]),
					};
				},
			});

			return target;
		};
}

export const GET = createRouteDecorator(HttpVerbs.GET);
export const POST = createRouteDecorator(HttpVerbs.POST);
export const PUT = createRouteDecorator(HttpVerbs.PUT);
export const DELETE = createRouteDecorator(HttpVerbs.DELETE);
export const PATCH = createRouteDecorator(HttpVerbs.PATCH);

export function controller(options?: ControllerOptions) {
	return (target: any, context: ClassDecoratorContext) => {
		if (!options) return target;

		update(context, {
			root: (previous) => {
				return {
					...previous,
					paths: uniq([...previous.paths, ...normalizePaths(options)]),
				};
			},
		});

		return target;
	};
}

export function before(middleware: MiddlewareParameter) {
	return (
		target: any,
		context: ClassMethodDecoratorContext | ClassDecoratorContext,
	) => {
		if (context.kind === "class") {
			update(context, {
				root: (previous) => {
					return {
						...previous,
						beforeMiddleware: appendMiddleware(
							previous.beforeMiddleware,
							middleware,
						),
					};
				},
			});

			return target;
		}

		update(context, {
			method: (previous) => {
				return {
					...previous,
					beforeMiddleware: appendMiddleware(
						previous.beforeMiddleware,
						middleware,
					),
				};
			},
		});

		return target;
	};
}

export function after(middleware: MiddlewareParameter) {
	return (
		target: any,
		context: ClassMethodDecoratorContext | ClassDecoratorContext,
	) => {
		if (context.kind === "class") {
			update(context, {
				root: (previous) => {
					return {
						...previous,
						afterMiddleware: appendMiddleware(
							previous.afterMiddleware,
							middleware,
						),
					};
				},
			});

			return target;
		}

		update(context, {
			method: (previous) => {
				return {
					...previous,
					afterMiddleware: appendMiddleware(
						previous.afterMiddleware,
						middleware,
					),
				};
			},
		});

		return target;
	};
}

export function schema(schema: RouteSchema) {
	return (target: any, context: ClassMethodDecoratorContext) => {
		update(context, {
			method: (previous) => {
				return {
					...previous,
					schema,
				};
			},
		});

		return target;
	};
}

////////////////////

function uniq<T>(items: T[]): T[] {
	const result: T[] = [];
	for (const item of items) {
		if (!result.includes(item)) result.push(item);
	}

	return result;
}

function normalizePaths(options: ControllerOptions): string[] {
	if (typeof options === "string") return [options];
	if (Array.isArray(options)) return options;

	return Array.isArray(options.path) ? options.path : [options.path];
}

function appendMiddleware(target: any[], incoming: MiddlewareParameter): any[] {
	return Array.isArray(incoming)
		? [...target, ...incoming]
		: [...target, incoming];
}

//-------------------------------------------------------
// helpers to prepare state before mapping to http framework
// ---------------------------------------------------------

export function rollUpHttpDecoratorState(
	root: RootState,
	method: MethodState,
): MethodState {
	return {
		...method,
		paths: concatPaths(root.paths, method.paths),
		beforeMiddleware: [...root.beforeMiddleware, ...method.beforeMiddleware],
		afterMiddleware: [...method.afterMiddleware, ...root.afterMiddleware],
	};
}

function concatPaths(rootPaths: string[], methodPaths: string[]): string[] {
	if (rootPaths.length === 0) return [...methodPaths];

	const result: string[] = [];
	rootPaths.forEach((rootPath) => {
		methodPaths.forEach((methodPath) => {
			result.push(rootPath + methodPath);
		});
	});

	return result;
}
