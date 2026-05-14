import type {
	DecoratorMethodState,
	DecoratorState,
	DecoratorToken,
	MethodName,
} from "../../../decorators/decorator-state.types.js";

export type AnyDecoratorToken = DecoratorToken<DecoratorState<any, any>>;

export type DecoratorExecutionContext<
	TToken extends AnyDecoratorToken = AnyDecoratorToken,
	TTarget extends object = object,
> = {
	target: TTarget;
	methodName: MethodName;
	moduleName: string;
	metadata: DecoratorMethodState<TToken["state"]>;
	decoratorState: TToken["state"];
};
