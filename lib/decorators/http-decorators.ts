import { type HttpVerb, HttpVerbs } from "../http/http-verbs.js";
import {
	addAfterMiddleware,
	addBeforeMiddleware,
	addHttpVerbs,
	addPaths,
	type MiddlewareParameter,
	type RouteSchema,
	setSchema,
	updateHttpDecoratorState,
} from "./http-state.js";
import { registerHttpRouteMarker } from "./http-initializer.js";

type ControllerOptions = string | string[] | { path: string | string[] };

function normalizePaths(options: ControllerOptions): string[] {
	if (typeof options === "string") return [options];
	if (Array.isArray(options)) return options;

	return Array.isArray(options.path) ? options.path : [options.path];
}

function createRouteDecorator(httpVerb: HttpVerb) {
	return (path: string = "/") =>
		(target: any, context: ClassMethodDecoratorContext) => {
			registerHttpRouteMarker()(target, context);

			updateHttpDecoratorState(context.metadata, (state) => {
				const withVerbs = addHttpVerbs(state, context.name, [httpVerb]);

				return addPaths(withVerbs, context.name, [path]);
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

		updateHttpDecoratorState(context.metadata, (state) =>
			addPaths(state, null, normalizePaths(options)),
		);

		return target;
	};
}

export function before(middleware: MiddlewareParameter) {
	return (
		target: any,
		context: ClassDecoratorContext | ClassMethodDecoratorContext,
	) => {
		const methodName =
			context.kind === "method"
				? (context as ClassMethodDecoratorContext).name
				: null;

		updateHttpDecoratorState(context.metadata, (state) =>
			addBeforeMiddleware(state, methodName, middleware),
		);

		return target;
	};
}

export function after(middleware: MiddlewareParameter) {
	return (
		target: any,
		context: ClassDecoratorContext | ClassMethodDecoratorContext,
	) => {
		const methodName =
			context.kind === "method"
				? (context as ClassMethodDecoratorContext).name
				: null;

		updateHttpDecoratorState(context.metadata, (state) =>
			addAfterMiddleware(state, methodName, middleware),
		);

		return target;
	};
}

export function schema(schemaDefinition: RouteSchema) {
	return (target: any, context: ClassMethodDecoratorContext) => {
		updateHttpDecoratorState(context.metadata, (state) =>
			setSchema(state, context.name, schemaDefinition),
		);

		return target;
	};
}

// https://www.reddit.com/r/typescript/comments/1bvul47/i_am_confused_with_typescript_decorator_metadata/
declare global {
	interface SymbolConstructor {
		readonly metadata: unique symbol;
	}
}
