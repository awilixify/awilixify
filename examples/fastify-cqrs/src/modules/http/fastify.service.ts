import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { Deps } from "./http.module.js";

export class FastifyService {
	constructor(
		private readonly app: Deps["app"],
		private readonly config: Deps["config"],
	) {}

	async init() {
		await this.app.register(fastifySwagger, {
			openapi: {
				info: {
					title: "Fastify Example API",
					version: "1.0.0",
				},
				servers: [
					{
						url: "http://localhost:3000",
						description: "Development server",
					},
				],
			},
		});

		await this.app.register(fastifySwaggerUi, {
			routePrefix: "/api-docs",
		});

		// NOTE: to see all schemas at end of file they got to be manually added
		// in route
		// https://github.com/fastify/help/issues/875
		// fastify.addSchema(this.config.response[200]);
		this.app.log.info(`Swagger documentation is available at /api-docs`);
	}

	async postInit() {
		try {
			await this.app.listen({
				port: this.config.get("port"),
				host: this.config.get("host"),
			});

			this.app.log.info(
				`Server running on http://localhost:${this.config.get("port")}`,
			);
		} catch (err) {
			this.app.log.error(err);
			process.exit(1);
		}
	}
}
