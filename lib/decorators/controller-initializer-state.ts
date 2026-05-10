import type { MethodName, MethodNameParameter } from "./http-state.js";

export const CONTROLLER_INITIALIZER_DECORATOR_STATE = Symbol(
	"Initializer State",
);

export type ControllerMetadataToken<T> = {
	key: symbol;
	// type-only marker for metadata payload
	readonly __meta?: T;
};

type ControllerInitializerMethodState = Map<symbol, unknown[]>;

type ControllerInitializerState = {
	methods: Map<MethodName, ControllerInitializerMethodState>;
};

export function createControllerMetadataToken<T>(
	description: string,
): ControllerMetadataToken<T> {
	return {
		key: Symbol(description),
	};
}

export function updateInitializerState(
	metadata: DecoratorMetadataObject,
	updater: (state: ControllerInitializerState) => ControllerInitializerState,
): void {
	metadata[CONTROLLER_INITIALIZER_DECORATOR_STATE] = updater(
		(metadata[
			CONTROLLER_INITIALIZER_DECORATOR_STATE
		] as ControllerInitializerState) ||
			createInitializerDecoratorState(),
	);
}

export function addControllerMethodMetadata(
	state: ControllerInitializerState,
	methodName: MethodNameParameter,
	token: ControllerMetadataToken<unknown>,
	value: unknown,
): ControllerInitializerState {
	if (methodName === null) return state;

	const methodState = getOrCreateMethodState(state, methodName);
	const existing = methodState.get(token.key) || [];
	const next = new Map(methodState);
	next.set(token.key, [...existing, value]);

	return updateMethodState(state, methodName, next);
}

export function getClassInitializerState(
	target: any,
): ControllerInitializerState | null {
	const metadataSymbol =
		(typeof Symbol !== "undefined" && Symbol.metadata) ||
		Object.getOwnPropertySymbols(target).find(
			(s) => s.toString() === "Symbol(Symbol.metadata)",
		);

	if (!metadataSymbol) return null;

	return (
		target[metadataSymbol]?.[CONTROLLER_INITIALIZER_DECORATOR_STATE] || null
	);
}

export function resolveControllerMethodMetadata<T>(
	target: any,
	methodName: string | symbol,
	token: ControllerMetadataToken<T>,
): T[] {
	const state = getClassInitializerState(target);

	if (!state) return [];

	const methodState = state.methods.get(methodName);

	if (!methodState) return [];

	return (methodState.get(token.key) || []) as T[];
}

function createInitializerDecoratorState(): ControllerInitializerState {
	return {
		methods: new Map<MethodName, ControllerInitializerMethodState>(),
	};
}

function getOrCreateMethodState(
	state: ControllerInitializerState,
	methodName: MethodName,
): ControllerInitializerMethodState {
	return state.methods.get(methodName) || new Map<symbol, unknown[]>();
}

function updateMethodState(
	state: ControllerInitializerState,
	methodName: MethodName,
	methodState: ControllerInitializerMethodState,
): ControllerInitializerState {
	const filteredEntries = Array.from(state.methods.entries()).filter(
		([key]) => key !== methodName,
	);

	return {
		...state,
		methods: new Map([...filteredEntries, [methodName, methodState]]),
	};
}
