import type {
	FastifyInstance as DefaultFastifyInstance,
	FastifyRequest,
	FastifyReply,
	FastifyBaseLogger,
	RawReplyDefaultExpression,
	RawRequestDefaultExpression,
	RawServerDefault,
	RouteGenericInterface,
	ContextConfigDefault,
} from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { Static, TSchema } from "@sinclair/typebox";
import type { RouteSchema } from "awilixify/http";

export type FastifyInstance = DefaultFastifyInstance<
	RawServerDefault,
	RawRequestDefaultExpression<RawServerDefault>,
	RawReplyDefaultExpression<RawServerDefault>,
	FastifyBaseLogger,
	TypeBoxTypeProvider
>;

export type Request<S extends RouteSchema> = FastifyRequest<{
	Querystring: S["querystring"] extends TSchema
		? Static<S["querystring"]>
		: unknown;
	Params: S["params"] extends TSchema ? Static<S["params"]> : unknown;
	Body: S["body"] extends TSchema ? Static<S["body"]> : unknown;
}>;

export type Reply<S extends RouteSchema> = FastifyReply<
	RouteGenericInterface,
	RawServerDefault,
	RawRequestDefaultExpression,
	RawReplyDefaultExpression,
	ContextConfigDefault,
	S,
	TypeBoxTypeProvider
>;
