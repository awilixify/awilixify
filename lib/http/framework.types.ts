import type { RouteSchema } from "../decorators/http-state.js";
import type { HttpVerb } from "./http-verbs.js";

export interface RouteOptions<TRequest = any, TReply = any> {
	method: string | string[];
	url: string;
	handler: (request: TRequest, reply: TReply) => any | Promise<any>;
	preHandler?: any[];
	schema?: RouteSchema;
}

export interface FastifyFramework<TRequest = any, TReply = any> {
	route(options: RouteOptions<TRequest, TReply>): void;
}

export type ExpressHandler<TRequest = any, TResponse = any> = (
	req: TRequest,
	res: TResponse,
	next?: (err?: any) => void,
) => any | Promise<any>;

export interface ExpressFramework<TRequest = any, TResponse = any> {
	get(path: string, ...handlers: ExpressHandler<TRequest, TResponse>[]): void;
	post(path: string, ...handlers: ExpressHandler<TRequest, TResponse>[]): void;
	put(path: string, ...handlers: ExpressHandler<TRequest, TResponse>[]): void;
	delete(
		path: string,
		...handlers: ExpressHandler<TRequest, TResponse>[]
	): void;
	patch(path: string, ...handlers: ExpressHandler<TRequest, TResponse>[]): void;
	options(
		path: string,
		...handlers: ExpressHandler<TRequest, TResponse>[]
	): void;
	head(path: string, ...handlers: ExpressHandler<TRequest, TResponse>[]): void;
}

export type ExpressMethod = Lowercase<Exclude<HttpVerb, "CONNECT" | "*">>;

export const HttpFramework = {
	FASTIFY: "fastify",
	EXPRESS: "express",
	UNKNOWN: "unknown",
} as const;

export type HttpFramework = (typeof HttpFramework)[keyof typeof HttpFramework];
