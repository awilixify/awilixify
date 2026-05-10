import type {
	Request as ExpressRequest,
	Response as ExpressResponse,
} from "express";
import type { Static, TSchema } from "@sinclair/typebox";
import type { RouteSchema } from "awilixify";

export type Request<S extends RouteSchema> = ExpressRequest<
	S["params"] extends TSchema ? Static<S["params"]> : any,
	any,
	S["body"] extends TSchema ? Static<S["body"]> : any,
	S["querystring"] extends TSchema ? Static<S["querystring"]> : any
>;

/**
 * Type-safe response with schema-derived types
 */
export type Response<S extends RouteSchema> = Omit<
	ExpressResponse,
	"status" | "json" | "send"
> & {
	status<Code extends keyof S["response"] & number>(
		code: Code,
	): Omit<ExpressResponse, "json" | "send"> & {
		json(body: ResponseBodyForStatus<S, Code>): ExpressResponse;
		send(body: ResponseBodyForStatus<S, Code>): ExpressResponse;
	};
	json(
		body: 200 extends keyof S["response"]
			? ResponseBodyForStatus<S, 200>
			: any,
	): ExpressResponse;
	send(
		body: 200 extends keyof S["response"]
			? ResponseBodyForStatus<S, 200>
			: any,
	): ExpressResponse;
};

type ResponseBodyForStatus<
	S extends RouteSchema,
	Code extends keyof S["response"],
> = S["response"][Code] extends TSchema ? Static<S["response"][Code]> : any;
