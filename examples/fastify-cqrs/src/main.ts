import { DIContext } from "awilixify";

import { ConfigModule } from "@/modules/config/config.module.js";
import { HttpModule } from "@/modules/http/http.module.js";
import { AppModule } from "@/modules/index.js";
import { TenantModule } from "@/modules/tenant/tenant.module.js";

async function bootstrap() {
	const app = DIContext.create(AppModule, {
		globalModules: [ConfigModule, TenantModule(), HttpModule],
	});

	await app.init();

	// commented out due it slows down hot reload
	// process.once("SIGINT", async () => {
	// 	await app.dispose();
	// });
	// process.once("SIGTERM", async () => {
	// 	await app.dispose();
	// });
}

bootstrap();
