import type { HttpVerb } from "../http/http-verbs.js";

export const HTTP_DECORATOR_STATE = Symbol("Router State");

export type MethodName = string | symbol;
export type MethodNameParameter = MethodName | null;
export type MiddlewareParameter = any[] | any;

export interface RouteSchema {
	body?: unknown;
	querystring?: unknown;
	params?: unknown;
	headers?: unknown;
	response?: unknown;
	description?: string;
	summary?: string;
	tags?: string[];
	operationId?: string;
	deprecated?: boolean;
}

export interface IRouteState {
	paths: string[];
	beforeMiddleware: any[];
	afterMiddleware: any[];
	verbs: HttpVerb[];
	schema: RouteSchema;
}

export interface IHttpDecoratorState {
	root: IRouteState;
	methods: Map<MethodName, IRouteState>;
}

export function hasValidationSchema(schema: RouteSchema): boolean {
	return !!(
		schema?.body ||
		schema?.querystring ||
		schema?.params ||
		schema?.headers
	);
}

export function getClassHttpDecoratorState(
	target: any,
): IHttpDecoratorState | null {
	const metadataSymbol =
		(typeof Symbol !== "undefined" && Symbol.metadata) ||
		Object.getOwnPropertySymbols(target).find(
			(s) => s.toString() === "Symbol(Symbol.metadata)",
		);

	if (!metadataSymbol) return null;

	return target[metadataSymbol]?.[HTTP_DECORATOR_STATE] || null;
}

export function updateHttpDecoratorState(
	metadata: DecoratorMetadataObject,
	updater: (state: IHttpDecoratorState) => IHttpDecoratorState,
): void {
	metadata[HTTP_DECORATOR_STATE] = updater(
		(metadata[HTTP_DECORATOR_STATE] as IHttpDecoratorState) ||
			createHttpDecoratorState(),
	);
}

export function addPaths(
	state: IHttpDecoratorState,
	methodName: MethodNameParameter,
	paths: string[],
): IHttpDecoratorState {
	const methodState = getOrCreateHttpMethodState(state, methodName);

	return updateHttpMethodState(state, methodName, {
		paths: uniq([...methodState.paths, ...paths]),
	});
}

export function addHttpVerbs(
	state: IHttpDecoratorState,
	methodName: MethodNameParameter,
	verbs: HttpVerb[],
): IHttpDecoratorState {
	const methodState = getOrCreateHttpMethodState(state, methodName);

	return updateHttpMethodState(state, methodName, {
		verbs: uniq([...methodState.verbs, ...verbs]),
	});
}

export function addBeforeMiddleware(
	state: IHttpDecoratorState,
	methodName: MethodNameParameter,
	middleware: MiddlewareParameter,
): IHttpDecoratorState {
	const methodState = getOrCreateHttpMethodState(state, methodName);

	return updateHttpMethodState(state, methodName, {
		beforeMiddleware: addMiddleware(methodState.beforeMiddleware, middleware),
	});
}

export function addAfterMiddleware(
	state: IHttpDecoratorState,
	methodName: MethodNameParameter,
	middleware: MiddlewareParameter,
): IHttpDecoratorState {
	const methodState = getOrCreateHttpMethodState(state, methodName);

	return updateHttpMethodState(state, methodName, {
		afterMiddleware: addMiddleware(methodState.afterMiddleware, middleware),
	});
}

export function setSchema(
	state: IHttpDecoratorState,
	methodName: MethodNameParameter,
	schema: RouteSchema,
): IHttpDecoratorState {
	return updateHttpMethodState(state, methodName, { schema });
}

function createHttpRouteState(): IRouteState {
	return {
		paths: [],
		beforeMiddleware: [],
		afterMiddleware: [],
		verbs: [],
		schema: {},
	};
}

function createHttpDecoratorState(): IHttpDecoratorState {
	return {
		root: createHttpRouteState(),
		methods: new Map<MethodName, IRouteState>(),
	};
}

function getOrCreateHttpMethodState(
	state: IHttpDecoratorState,
	methodName: MethodNameParameter,
): IRouteState {
	const methodState =
		methodName === null ? state.root : state.methods.get(methodName);

	if (!methodState) {
		return createHttpRouteState();
	}

	return methodState;
}

function updateHttpMethodState(
	state: IHttpDecoratorState,
	methodName: MethodNameParameter,
	newState: Partial<IRouteState>,
): IHttpDecoratorState {
	const mergedState: IRouteState = {
		...getOrCreateHttpMethodState(state, methodName),
		...newState,
	};

	if (methodName === null) {
		return {
			...state,
			root: mergedState,
		};
	}

	const filteredEntries = Array.from(state.methods.entries()).filter(
		([key]) => key !== methodName,
	);

	return {
		...state,
		methods: new Map([...filteredEntries, [methodName, mergedState]]),
	};
}

function addMiddleware(targetArray: any[], value: MiddlewareParameter) {
	return Array.isArray(value)
		? [...targetArray, ...value]
		: [...targetArray, value];
}

function uniq<T>(src: Array<T>): Array<T> {
	const result: Array<T> = [];
	src.forEach((t) => {
		if (result.indexOf(t) === -1) {
			result.push(t);
		}
	});

	return result;
}
