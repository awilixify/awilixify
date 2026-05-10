import { DIContext, OpenAPIBuilder } from "awilixify";
import { buildApp } from "@/app.js";
import { AppModule } from "@/modules/index.js";
import { setupSwagger } from "./setup-swagger.js";
import { createValidationMiddleware } from "./ajv-validation.middleware.js";
import { errorHandler } from "./error-handler.middleware.js";

async function bootstrap() {
	const app = buildApp();
	const openapiBuilder = new OpenAPIBuilder();

	DIContext.create(AppModule, {
		framework: app,
		beforeRouteRegistered: ({ method, path, schema }) => {
			openapiBuilder.registerRoute(method, path, schema);

			return [createValidationMiddleware(schema)];
		},
	});

	setupSwagger(app, openapiBuilder.buildPaths());

	app.use(errorHandler);

	const PORT = 3000;

	app.listen(PORT, () => {
		console.log(`Server running on http://localhost:${PORT}`);
		console.log(`API Documentation: http://localhost:${PORT}/api-docs`);
	});
}

bootstrap();
