import type { Constructor } from "awilix";
import type {
	AnyDecoratorToken,
	DecoratorExecutionContext,
} from "./decorator-context.types.js";

export type DefInitializerMap = Record<string, ConstructorInitializer>;

export interface ConstructorInitializer {
	new (...args: any[]): Initializer;
}

export type InitializerContext<
	TToken extends AnyDecoratorToken = AnyDecoratorToken,
> = DecoratorExecutionContext<TToken, Constructor<any>> & {
	invoke: (...args: unknown[]) => unknown | Promise<unknown>;
};

export interface Initializer<
	TToken extends AnyDecoratorToken = AnyDecoratorToken,
> {
	token: TToken;
	initialize: (context: InitializerContext<TToken>) => void | Promise<void>;
}

export type AnyInitializer = ConstructorInitializer;
