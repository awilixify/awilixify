import { DIContext } from "awilixify";

import { buildApp } from "@/app.js";
import { ConfigModule } from "@/modules/config/config.module.js";
import type { ConfigService } from "@/modules/config/config.service.js";

import { HttpModule } from "@/modules/http/http.module.js";
import { AppModule } from "@/modules/index.js";
import { TenantModule } from "@/modules/tenant/tenant.module.js";
import { setupSwagger } from "./setup-swagger.js";

async function bootstrap() {
	const fastify = buildApp();

	// TODO: to init
	await setupSwagger(fastify);

	const appRoot = DIContext.create(AppModule, {
		globalModules: [ConfigModule, TenantModule(), HttpModule(fastify)],
	});
	await appRoot.init();

	const config = appRoot.scope.resolve<ConfigService>("config");

	try {
		await fastify.listen({
			port: config.get("port"),
			host: config.get("host"),
		});

		console.log(`Server running on http://localhost:${config.get("port")}`);
	} catch (err) {
		fastify.log.error(err);
		process.exit(1);
	}
}

bootstrap();
