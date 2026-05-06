import { describe, expect, it } from "vitest";

import {
	after as AFTER,
	before as BEFORE,
	controller,
	DELETE,
	GET,
	PATCH,
	POST,
	PUT,
	schema,
} from "../lib/decorators/http-decorators.js";
import { HttpVerbs } from "../lib/http/http-verbs.js";
import {
	HTTP_DECORATOR_STATE,
	hasValidationSchema,
	type IHttpDecoratorState,
} from "../lib/decorators/http-state.js";

/**
 * Helper function to get decorator state from a class
 * Mirrors the approach used in controller-processor.ts
 */
function getDecoratorState(target: any): IHttpDecoratorState | null {
	const symbol = Object.getOwnPropertySymbols(target).find(
		(s) => s.toString() === "Symbol(Symbol.metadata)",
	);

	if (!symbol) return null;

	return target[symbol][HTTP_DECORATOR_STATE] || null;
}

describe("Decorators", () => {
	describe("Route Decorators", () => {
		it("should use default path '/' when no path is provided", () => {
			class TestController {
				@GET()
				root() {}
			}

			const state = getDecoratorState(TestController);

			const routeState = state?.methods.get("root");
			expect(routeState?.paths).toEqual(["/"]);
		});

		it("should handle methods with no decorators", () => {
			class TestController {
				regularMethod() {}
			}

			const state = getDecoratorState(TestController);

			expect(state).toBeNull();
		});

		it("should assign HTTP verb decorators to different methods", () => {
			class TestController {
				@GET("/users")
				getUsers() {}

				@POST("/users")
				@GET("/users")
				createUser() {}

				@PUT("/users/:id")
				@PATCH("/users/:userId")
				updateUser() {}

				@DELETE("/users/:id")
				deleteUser() {}

				@PATCH("/users/:id")
				patchUser() {}
			}

			const state = getDecoratorState(TestController);

			expect(state).not.toBeNull();

			// GET
			expect(state?.methods.has("getUsers")).toBe(true);
			const getUsersRoute = state?.methods.get("getUsers");
			expect(getUsersRoute?.verbs).toEqual([HttpVerbs.GET]);
			expect(getUsersRoute?.paths).toEqual(["/users"]);

			// POST, no path dublication
			const createUserRoute = state?.methods.get("createUser");
			expect(createUserRoute?.verbs).toEqual([HttpVerbs.GET, HttpVerbs.POST]);
			expect(createUserRoute?.paths).toEqual(["/users"]);

			// PUT
			const updateUserRoute = state?.methods.get("updateUser");
			expect(updateUserRoute?.verbs).toEqual([HttpVerbs.PATCH, HttpVerbs.PUT]);
			expect(updateUserRoute?.paths).toEqual(["/users/:userId", "/users/:id"]);

			// DELETE
			const deleteUserRoute = state?.methods.get("deleteUser");
			expect(deleteUserRoute?.verbs).toEqual([HttpVerbs.DELETE]);
			expect(deleteUserRoute?.paths).toEqual(["/users/:id"]);

			// PATCH
			const patchUserRoute = state?.methods.get("patchUser");
			expect(patchUserRoute?.verbs).toEqual([HttpVerbs.PATCH]);
			expect(patchUserRoute?.paths).toEqual(["/users/:id"]);
		});
	});

	describe("Controller Decorator", () => {
		it("should assign single path to controller without dublication", () => {
			@controller(["/api", "/api"])
			class TestController {}

			const state = getDecoratorState(TestController);

			expect(state?.root.paths).toEqual(["/api"]);
		});

		it("should assign multiple paths (array) to controller", () => {
			@controller(["/api", "/v1/api"])
			class TestController {}

			const state = getDecoratorState(TestController);

			expect(state?.root.paths).toEqual(["/api", "/v1/api"]);
		});

		it("should assign path from object format to controller", () => {
			@controller({ path: "/api" })
			class TestController {}

			const state = getDecoratorState(TestController);

			expect(state?.root.paths).toEqual(["/api"]);
		});

		it("should assign multiple paths from object format to controller", () => {
			@controller({ path: ["/api", "/v1/api"] })
			class TestController {}

			const state = getDecoratorState(TestController);

			expect(state?.root.paths).toEqual(["/api", "/v1/api"]);
		});

		it("should not modify metadata when controller has no options and no decorated methods", () => {
			@controller()
			class TestController {}

			const state = getDecoratorState(TestController);

			expect(state).toBeNull();
		});
	});

	describe("Middleware Decorators", () => {
		const mockMiddleware1 = () => {};
		const mockMiddleware2 = () => {};
		const mockMiddleware3 = () => {};

		it("should stack multiple middleware decorators on method", () => {
			class TestController {
				@BEFORE(mockMiddleware2)
				@BEFORE(mockMiddleware1)
				@AFTER(mockMiddleware3)
				@AFTER([mockMiddleware1, mockMiddleware2])
				getUsers() {}
			}

			const state = getDecoratorState(TestController);

			const routeState = state?.methods.get("getUsers");
			expect(routeState?.beforeMiddleware).toEqual([
				mockMiddleware1,
				mockMiddleware2,
			]);
			expect(routeState?.afterMiddleware).toEqual([
				mockMiddleware1,
				mockMiddleware2,
				mockMiddleware3,
			]);
		});
	});

	describe("Combined Decorators", () => {
		const authMiddleware = () => {};
		const loggingMiddleware = () => {};

		it("should combine multiple decorators on a method and on class", () => {
			@controller("/api")
			@BEFORE(authMiddleware)
			@AFTER(loggingMiddleware)
			class TestController {
				@BEFORE(authMiddleware)
				@AFTER(loggingMiddleware)
				@POST("/users")
				createUser() {}
			}

			const state = getDecoratorState(TestController);

			const routeState = state?.methods.get("createUser");

			// Class-level middleware
			expect(state?.root.beforeMiddleware).toEqual([authMiddleware]);
			expect(state?.root.afterMiddleware).toEqual([loggingMiddleware]);
			expect(state?.root.paths).toEqual(["/api"]);

			expect(routeState?.verbs).toEqual([HttpVerbs.POST]);
			expect(routeState?.paths).toEqual(["/users"]);
			expect(routeState?.beforeMiddleware).toEqual([authMiddleware]);
			expect(routeState?.afterMiddleware).toEqual([loggingMiddleware]);
		});
	});

	describe("Schema Decorator", () => {
		it("should add schema to a method", () => {
			const testSchema = {
				body: { type: "object", properties: { name: { type: "string" } } },
				querystring: { type: "object" },
				params: { type: "object" },
				headers: { type: "object" },
				response: {
					200: { type: "object", properties: { id: { type: "number" } } },
				},
			};

			class TestController {
				@GET("/users")
				@schema(testSchema)
				getUsers() {}
			}

			const state = getDecoratorState(TestController);
			const routeState = state?.methods.get("getUsers");

			expect(routeState?.schema).toEqual(testSchema);
		});
	});

	describe("hasValidationSchema", () => {
		it("should return true when schema has body", () => {
			expect(hasValidationSchema({ body: { type: "object" } })).toBe(true);
		});

		it("should return true when schema has querystring", () => {
			expect(hasValidationSchema({ querystring: { type: "object" } })).toBe(
				true,
			);
		});

		it("should return true when schema has params", () => {
			expect(hasValidationSchema({ params: { type: "object" } })).toBe(true);
		});

		it("should return true when schema has headers", () => {
			expect(hasValidationSchema({ headers: { type: "object" } })).toBe(true);
		});

		it("should return false when schema has only response", () => {
			expect(
				hasValidationSchema({ response: { 200: { type: "object" } } }),
			).toBe(false);
		});

		it("should return false when schema has only metadata fields", () => {
			expect(
				hasValidationSchema({
					description: "Test endpoint",
					summary: "Test",
					tags: ["test"],
				}),
			).toBe(false);
		});

		it("should return false when schema is empty", () => {
			expect(hasValidationSchema({})).toBe(false);
		});
	});
});
