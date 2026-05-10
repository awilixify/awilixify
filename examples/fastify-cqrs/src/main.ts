import { DIContext } from "awilixify";

import { buildApp } from "@/app.js";
import { AppModule } from "@/modules/index.js";
import { TenantModule } from "@/modules/tenant/tenant.module.js";
import { setupSwagger } from "./setup-swagger.js";

async function bootstrap() {
	const fastify = buildApp();

	await setupSwagger(fastify);

	DIContext.create(AppModule, {
		framework: fastify,
		globalModules: [TenantModule(fastify)],
	});

	try {
		await fastify.listen({ port: 3000, host: "0.0.0.0" });
		console.log("Server running on http://localhost:3000");
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
}

bootstrap();
