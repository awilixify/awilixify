import fastifySwagger from "@fastify/swagger";
import fastifySwaggerUi from "@fastify/swagger-ui";
import { Deps } from "./http.module.js";

export class FastifyService {
	constructor(private readonly deps: Deps) {}

	async init() {
		await this.deps.app.register(fastifySwagger, {
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

		await this.deps.app.register(fastifySwaggerUi, {
			routePrefix: "/api-docs",
		});

		// NOTE: to see all schemas at end of file they got to be manually added
		// in route
		// https://github.com/fastify/help/issues/875
		// fastify.addSchema(this.config.response[200]);
		this.deps.app.log.info(`Swagger documentation is available at /api-docs`);
	}

	async postInit() {
		try {
			await this.deps.app.listen({
				port: this.deps.config.get("port"),
				host: this.deps.config.get("host"),
			});

			this.deps.app.log.info(
				`Server running on http://localhost:${this.deps.config.get("port")}`,
			);
		} catch (err) {
			this.deps.app.log.error(err);
			process.exit(1);
		}
	}
}
