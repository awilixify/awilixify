import type { AnyContract } from "./contract.types.js";
import type { EmptyContext } from "./middleware.types.js";

export interface Handler<C extends AnyContract, K extends C["key"] = C["key"]> {
	// TODO: similar like state bound by token in decorator world it's possible
	// to have readonly contract = createContract<Payload, Response>(key)
	readonly contract: C;
	executor: Executor<
		ExtractPayload<C, K>,
		ExtractResponse<C, K>,
		ExtractContractContext<C>
	>;
}

export type Executor<
	P = unknown,
	R = unknown,
	Ctx extends EmptyContext = EmptyContext,
> = (payload: P, context: Ctx) => Promise<R>;

type ExtractContractContext<C extends AnyContract> = C extends {
	context: infer TContext extends Record<string, unknown>;
}
	? TContext
	: EmptyContext;

type ExtractContractByKey<C extends AnyContract, K extends C["key"]> = Extract<
	C,
	{ key: K }
>;

export type ExtractPayload<
	C extends AnyContract,
	K extends C["key"],
> = ExtractContractByKey<C, K>["payload"];

export type ExtractResponse<
	C extends AnyContract,
	K extends C["key"],
> = ExtractContractByKey<C, K>["response"];
