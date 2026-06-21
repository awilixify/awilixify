import type {
	DecoratorMethodState,
	DecoratorState,
	DecoratorToken,
	MethodName,
	MethodStateFrom,
	MethodUpdate,
	RootStateFrom,
	RootUpdate,
	StateInitializers,
	StateUpdate,
} from "./decorator-state.types.js";
import "./decorator-metadata-symbol.js";

export function createDecoratorStateUpdater<
	TInitializers extends { method: () => unknown; root?: () => unknown } = {
		method: () => unknown;
	},
>(description: string, initializers: TInitializers) {
	type TState = DecoratorState<
		MethodStateFrom<TInitializers>,
		RootStateFrom<TInitializers>
	>;

	const token = {
		stateSymbol: Symbol(`DecoratorState:${description}`),
		// To store phantom store prop only for type
	} as DecoratorToken<TState>;

	return {
		token,
		update: createUpdater(token, {
			...initializers,
			root: initializers.root ?? (() => null),
		} as StateInitializers<TState>),
	};
}

export function resolveDecoratorState<TState extends DecoratorState<any, any>>(
	target: unknown,
	token: DecoratorToken<TState>,
): TState | null {
	const metadataSymbol = typeof Symbol !== "undefined" && Symbol.metadata;

	if (!metadataSymbol) return null;

	return (
		((target as any)[metadataSymbol]?.[token.stateSymbol] as TState) || null
	);
}

export function hasDecoratorMethodMetadata(target: unknown): boolean {
	return [target, (target as { prototype?: unknown })?.prototype].some(
		(value) => hasOwnDecoratorMethodMetadata(value),
	);
}

function hasOwnDecoratorMethodMetadata(target: unknown): boolean {
	if (
		target === null ||
		(typeof target !== "object" && typeof target !== "function")
	) {
		return false;
	}

	const metadataSymbol = typeof Symbol !== "undefined" && Symbol.metadata;

	if (!metadataSymbol) return false;

	const metadata = (target as any)[metadataSymbol];

	if (!metadata || typeof metadata !== "object") return false;

	return [
		...Object.getOwnPropertyNames(metadata).map((key) => metadata[key]),
		...Object.getOwnPropertySymbols(metadata).map((key) => metadata[key]),
	].some(
		(state) =>
			typeof state === "object" &&
			state !== null &&
			"methods" in state &&
			(state as { methods?: unknown }).methods instanceof Map &&
			(state as { methods: Map<unknown, unknown> }).methods.size > 0,
	);
}

function createUpdater<TState extends DecoratorState<any, any>>(
	token: DecoratorToken<TState>,
	initializers: StateInitializers<TState>,
) {
	const initializeState = () => ({
		root: initializers.root(),
		methods: new Map<MethodName, DecoratorMethodState<TState>>(),
	});

	function update(
		context: ClassDecoratorContext<any>,
		updater: RootUpdate<TState>,
	): void;

	function update(
		context: ClassMethodDecoratorContext<any, any>,
		updater: MethodUpdate<TState>,
	): void;

	function update(
		context: ClassDecoratorContext<any> | ClassMethodDecoratorContext<any, any>,
		updater: StateUpdate<TState>,
	): void {
		if (!context.metadata) return;

		const state =
			(context.metadata[token.stateSymbol] as TState) || initializeState();

		if (context.kind === "class") {
			if (!("root" in updater)) return;

			context.metadata[token.stateSymbol] = {
				...state,
				root: updater.root(state.root),
			};

			return;
		}

		if (!("method" in updater)) return;

		const nextMethods = new Map(state.methods);
		nextMethods.set(
			context.name,
			updater.method(nextMethods.get(context.name) ?? initializers.method()),
		);

		context.metadata[token.stateSymbol] = {
			...state,
			methods: nextMethods,
		};
	}

	return update;
}
