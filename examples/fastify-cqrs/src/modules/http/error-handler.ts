import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { HttpException, HttpStatus } from "awilixify/http";

import type { FastifyInstance } from "./types.js";

export function setupErrorHandler(app: FastifyInstance): void {
	app.setErrorHandler(
		(error: FastifyError | Error, _: FastifyRequest, reply: FastifyReply) => {
			if (error instanceof HttpException) {
				return reply.status(error.getStatus()).send({
					...error.getResponse(),
				});
			}

			const statusCode =
				"statusCode" in error
					? error.statusCode || HttpStatus.INTERNAL_SERVER_ERROR
					: HttpStatus.INTERNAL_SERVER_ERROR;
			reply.status(statusCode).send({
				message: error.message || "Internal Server Error",
				statusCode,
			});
		},
	);
}
