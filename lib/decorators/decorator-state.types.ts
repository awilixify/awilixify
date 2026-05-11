export type MethodName = string | symbol;

export type DecoratorState<TMethod, TRoot = null> = {
	root: TRoot;
	methods: Map<MethodName, TMethod>;
};

export type DecoratorMethodState<TState> =
	TState extends DecoratorState<infer TMethod, any> ? TMethod : never;

export type DecoratorRootState<TState> =
	TState extends DecoratorState<any, infer TRoot> ? TRoot : never;

export type StateInitializers<TState extends DecoratorState<any, any>> = {
	method: () => DecoratorMethodState<TState>;
	root: () => DecoratorRootState<TState>;
};

type StateUpdater<T> = (previous: T) => T;

export type RootUpdate<TState extends DecoratorState<any, any>> = {
	root: StateUpdater<DecoratorRootState<TState>>;
};

export type MethodUpdate<TState extends DecoratorState<any, any>> = {
	method: StateUpdater<DecoratorMethodState<TState>>;
};

export type StateUpdate<TState extends DecoratorState<any, any>> =
	| RootUpdate<TState>
	| MethodUpdate<TState>;

export type DecoratorToken<TState extends DecoratorState<any, any>> = {
	stateSymbol: symbol;
	readonly state: TState;
};

export type MethodStateFrom<TInitializers> = TInitializers extends {
	method: () => infer TMethod;
}
	? TMethod
	: never;

export type RootStateFrom<TInitializers> = TInitializers extends {
	root: () => infer TRoot;
}
	? TRoot
	: null;

declare global {
	interface SymbolConstructor {
		readonly metadata: unique symbol;
	}
}
