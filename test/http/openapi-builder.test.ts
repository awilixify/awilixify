import { describe, expect, it } from "vitest";

import {
	hasValidationSchema,
	OpenAPIBuilder,
} from "../../lib/http/openapi-builder.js";

describe("OpenAPIBuilder", () => {
	describe("hasValidationSchema", () => {
		it("returns true when body, querystring, params, or headers are present", () => {
			expect(hasValidationSchema({ body: { type: "object" } })).toBe(true);
			expect(hasValidationSchema({ querystring: { type: "object" } })).toBe(
				true,
			);
			expect(hasValidationSchema({ params: { type: "object" } })).toBe(true);
			expect(hasValidationSchema({ headers: { type: "object" } })).toBe(true);
		});

		it("returns false for response-only, metadata-only, and empty schemas", () => {
			expect(
				hasValidationSchema({ response: { 200: { type: "object" } } }),
			).toBe(false);
			expect(
				hasValidationSchema({
					description: "Test endpoint",
					summary: "Test",
					tags: ["test"],
				}),
			).toBe(false);
			expect(hasValidationSchema({})).toBe(false);
		});
	});

	describe("buildPaths", () => {
		it("builds OpenAPI operations with normalized methods and grouped paths", () => {
			const builder = new OpenAPIBuilder();

			builder.registerRoute("GET", "/users/{id}", {
				summary: "Get user",
				description: "Fetches a single user",
				tags: ["users"],
				operationId: "getUser",
				deprecated: true,
				querystring: {
					type: "object",
					properties: {
						includePosts: { type: "boolean" },
					},
					required: ["includePosts"],
				},
				params: {
					type: "object",
					properties: {
						id: { type: "string" },
					},
				},
				body: {
					type: "object",
					properties: {
						filter: { type: "string" },
					},
				},
				response: {
					200: {
						type: "object",
						properties: {
							id: { type: "string" },
						},
					},
					404: {
						type: "object",
						properties: {
							message: { type: "string" },
						},
					},
				},
			});

			builder.registerRoute("POST", "/users/{id}", {});

			expect(builder.buildPaths()).toEqual({
				"/users/{id}": {
					get: {
						summary: "Get user",
						description: "Fetches a single user",
						tags: ["users"],
						operationId: "getUser",
						deprecated: true,
						parameters: [
							{
								name: "includePosts",
								in: "query",
								required: true,
								schema: { type: "boolean" },
							},
							{
								name: "id",
								in: "path",
								required: true,
								schema: { type: "string" },
							},
						],
						requestBody: {
							required: true,
							content: {
								"application/json": {
									schema: {
										type: "object",
										properties: {
											filter: { type: "string" },
										},
									},
								},
							},
						},
						responses: {
							200: {
								description: "Successful response",
								content: {
									"application/json": {
										schema: {
											type: "object",
											properties: {
												id: { type: "string" },
											},
										},
									},
								},
							},
							404: {
								description: "Response",
								content: {
									"application/json": {
										schema: {
											type: "object",
											properties: {
												message: { type: "string" },
											},
										},
									},
								},
							},
						},
					},
					post: {
						responses: {},
					},
				},
			});
		});

		it("omits parameters and requestBody when schemas do not define them", () => {
			const builder = new OpenAPIBuilder();

			builder.registerRoute("GET", "/health", {
				response: {
					200: { type: "string" },
				},
			});

			expect(builder.buildPaths()).toEqual({
				"/health": {
					get: {
						responses: {
							200: {
								description: "Successful response",
								content: {
									"application/json": {
										schema: { type: "string" },
									},
								},
							},
						},
					},
				},
			});
		});
	});
});
