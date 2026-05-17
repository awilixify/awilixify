import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import Fastify from "fastify";

import type { FastifyInstance } from "./types.js";
import { setupErrorHandler } from "./error-handler.js";
import { extractReqContextMiddleware } from "./request-context.middleware.js";

export function initializeFastify() {
	const app: FastifyInstance = Fastify({
		logger: true,
	}).withTypeProvider<TypeBoxTypeProvider>();

	// Turns off response validation
	app.setSerializerCompiler(() => {
		return (data) => JSON.stringify(data);
	});

	app.addHook("onRequest", extractReqContextMiddleware);

	setupErrorHandler(app);

	return app;
}
