import type { Constructor } from "awilix";
import type {
	AnyDecoratorToken,
	DecoratorExecutionContext,
} from "./decorator-context.types.js";

export type DefInitializerMap = Record<string, ConstructorInitializer>;

export interface ConstructorInitializer {
	new (...args: any[]): Initializer<any, boolean>;
}

export type MetadataInitializerContext<
	TToken extends AnyDecoratorToken = AnyDecoratorToken,
> = DecoratorExecutionContext<TToken, Constructor<any>>;

export type InitializerContext<
	TToken extends AnyDecoratorToken = AnyDecoratorToken,
> = MetadataInitializerContext<TToken> & {
	invoke: (...args: unknown[]) => unknown | Promise<unknown>;
};

export abstract class Initializer<
	TToken extends AnyDecoratorToken = AnyDecoratorToken,
	TUsesInvoke extends boolean = true,
> {
	public abstract readonly token: TToken;
	public readonly usesInvoke = true as TUsesInvoke;

	public abstract initialize(
		context: TUsesInvoke extends true
			? InitializerContext<TToken>
			: MetadataInitializerContext<TToken>,
	): void | Promise<void>;
}

export type AnyInitializer = ConstructorInitializer;
