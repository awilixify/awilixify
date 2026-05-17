import type { FastifyRequest, FastifyReply } from "fastify";

export interface RequestContext {
	token?: string; // Authorization header
	requestId: string; // Request ID from Fastify
	ip: string; // Client IP address
}

export async function extractReqContextMiddleware(
	req: FastifyRequest,
	_reply: FastifyReply,
) {
	req.context = {
		token: req.headers.authorization,
		requestId: req.id,
		ip: req.ip,
	};
}

declare module "fastify" {
	interface FastifyRequest {
		context: RequestContext;
	}
}

declare module "awilixify" {
	interface ExecutionContext extends RequestContext {}
}
