import { DIContext } from "awilixify";

import { ConfigModule } from "@/integrations/config/config.module.js";
import { HttpModule } from "@/integrations/http/http.module.js";
import { TenantModule } from "@/integrations/tenant/tenant.module.js";
import { AppModule } from "@/modules/index.js";

async function bootstrap() {
	const devtoolsModule =
		process.env.NODE_ENV === "development"
			? (await import("awilixify-devtools")).DevtoolsModule({
					appUrl: "http://localhost:3000",
				})
			: undefined;

	const app = DIContext.create(AppModule, {
		globalModules: [
			...(devtoolsModule ? [devtoolsModule] : []),
			ConfigModule,
			TenantModule(),
			HttpModule,
		],
	});

	await app.init();

	// commented out due it slows down hot reload
	// app.enableShutdownHooks();
}

bootstrap();
