import type { MethodName, MethodNameParameter } from "./http-state.js";

export const INTERCEPTOR_DECORATOR_STATE = Symbol("Interceptor State");

type InterceptorMethodState = { meta: Record<string, unknown> };

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

export function setInterceptorMetadata(
	state: InterceptorState,
	methodName: MethodNameParameter,
	key: string,
	value: unknown,
): InterceptorState {
	if (methodName === null) {
		return state;
	}

	const methodState = getOrCreateInterceptorMethodState(state, methodName);

	return updateInterceptorMethodState(state, methodName, {
		meta: {
			...methodState.meta,
			[key]: value,
		},
	});
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

function createInterceptorMethodState(): InterceptorMethodState {
	return { meta: {} };
}

function createInterceptorDecoratorState(): InterceptorState {
	return {
		methods: new Map<MethodName, InterceptorMethodState>(),
	};
}

function getOrCreateInterceptorMethodState(
	state: InterceptorState,
	methodName: MethodNameParameter,
): InterceptorMethodState {
	if (methodName === null) return createInterceptorMethodState();

	return state.methods.get(methodName) || createInterceptorMethodState();
}

function updateInterceptorMethodState(
	state: InterceptorState,
	methodName: MethodNameParameter,
	newState: Partial<InterceptorMethodState>,
): InterceptorState {
	const mergedState: InterceptorMethodState = {
		...getOrCreateInterceptorMethodState(state, methodName),
		...newState,
	};

	if (methodName === null) return state;

	const filteredEntries = Array.from(state.methods.entries()).filter(
		([key]) => key !== methodName,
	);

	return {
		...state,
		methods: new Map([...filteredEntries, [methodName, mergedState]]),
	};
}
