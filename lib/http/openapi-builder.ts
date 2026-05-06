import type { RouteSchema } from "../decorators/http-state.js";

export interface RouteRegistration {
	method: string;
	path: string;
	schema: RouteSchema;
}

export class OpenAPIBuilder {
	private routes: RouteRegistration[] = [];

	registerRoute(method: string, path: string, schema: RouteSchema): void {
		this.routes.push({ method: method.toLowerCase(), path, schema });
	}

	buildPaths(): Record<string, any> {
		return this.routes.reduce<Record<string, any>>((paths, route) => {
			paths[route.path] ??= {};
			paths[route.path][route.method] = this.buildOperation(route.schema);

			return paths;
		}, {});
	}

	private buildOperation(schema: RouteSchema): any {
		const parameters = this.buildParameters(schema);
		const requestBody = this.buildRequestBody(schema);
		const responses = this.buildResponses(schema);

		return {
			...(schema.summary && { summary: schema.summary }),
			...(schema.description && { description: schema.description }),
			...(schema.tags && { tags: schema.tags }),
			...(schema.operationId && { operationId: schema.operationId }),
			...(schema.deprecated && { deprecated: schema.deprecated }),
			...(parameters.length > 0 && { parameters }),
			...(requestBody && { requestBody }),
			responses,
		};
	}

	private buildParameters(schema: RouteSchema): any[] {
		const parameters: any[] = [];

		const querySchema = schema.querystring as any;
		if (querySchema?.properties) {
			parameters.push(
				...Object.entries(querySchema.properties).map(([name, propSchema]) => ({
					name,
					in: "query",
					required: querySchema.required?.includes(name) ?? false,
					schema: propSchema,
				})),
			);
		}

		const paramsSchema = schema.params as any;
		if (paramsSchema?.properties) {
			parameters.push(
				...Object.entries(paramsSchema.properties).map(
					([name, propSchema]) => ({
						name,
						in: "path",
						required: true,
						schema: propSchema,
					}),
				),
			);
		}

		return parameters;
	}

	private buildRequestBody(schema: RouteSchema): any | undefined {
		return schema.body
			? {
					required: true,
					content: {
						"application/json": {
							schema: schema.body,
						},
					},
				}
			: undefined;
	}

	private buildResponses(schema: RouteSchema): Record<string, any> {
		if (!schema.response) return {};

		return Object.entries(schema.response).reduce<Record<string, any>>(
			(acc, [statusCode, responseSchema]) => {
				acc[statusCode] = {
					description:
						statusCode === "200" ? "Successful response" : "Response",
					content: {
						"application/json": {
							schema: responseSchema,
						},
					},
				};

				return acc;
			},
			{},
		);
	}
}
