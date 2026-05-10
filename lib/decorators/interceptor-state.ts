import type { MethodName, MethodNameParameter } from "./http-state.js";
import type { InterceptorMetadataToken } from "../di/interceptor.types.js";

export const INTERCEPTOR_DECORATOR_STATE = Symbol("Interceptor State");

type InterceptorMethodState = Map<symbol, unknown[]>;

type InterceptorState = {
	methods: Map<MethodName, InterceptorMethodState>;
};

export function updateInterceptorState(
	metadata: DecoratorMetadataObject,
	updater: (state: InterceptorState) => InterceptorState,
): void {
	metadata[INTERCEPTOR_DECORATOR_STATE] = updater(
		(metadata[INTERCEPTOR_DECORATOR_STATE] as InterceptorState) ||
			createInterceptorDecoratorState(),
	);
}

export function addInterceptorMethodMetadata(
	state: InterceptorState,
	methodName: MethodNameParameter,
	token: InterceptorMetadataToken<unknown>,
	value: unknown,
): InterceptorState {
	if (methodName === null) return state;

	const methodState = getOrCreateMethodState(state, methodName);
	const existing = methodState.get(token.key) || [];
	const next = new Map(methodState);
	next.set(token.key, [...existing, value]);

	return updateMethodState(state, methodName, next);
}

export function getClassInterceptorState(target: any): InterceptorState | null {
	const metadataSymbol =
		(typeof Symbol !== "undefined" && Symbol.metadata) ||
		Object.getOwnPropertySymbols(target).find(
			(s) => s.toString() === "Symbol(Symbol.metadata)",
		);

	if (!metadataSymbol) return null;

	return target[metadataSymbol]?.[INTERCEPTOR_DECORATOR_STATE] || null;
}

export function resolveInterceptorMethodMetadata<T>(
	target: any,
	methodName: string | symbol,
	token: InterceptorMetadataToken<T>,
): T[] {
	const state = getClassInterceptorState(target);
	if (!state) return [];

	const methodState = state.methods.get(methodName);
	if (!methodState) return [];

	return (methodState.get(token.key) || []) as T[];
}

function createInterceptorDecoratorState(): InterceptorState {
	return {
		methods: new Map<MethodName, InterceptorMethodState>(),
	};
}

function getOrCreateMethodState(
	state: InterceptorState,
	methodName: MethodName,
): InterceptorMethodState {
	return state.methods.get(methodName) || new Map<symbol, unknown[]>();
}

function updateMethodState(
	state: InterceptorState,
	methodName: MethodName,
	methodState: InterceptorMethodState,
): InterceptorState {
	const filteredEntries = Array.from(state.methods.entries()).filter(
		([key]) => key !== methodName,
	);

	return {
		...state,
		methods: new Map([...filteredEntries, [methodName, methodState]]),
	};
}
