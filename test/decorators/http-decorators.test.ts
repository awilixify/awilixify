import { describe, expect, it } from "vitest";
import {
	hasDecoratorMethodMetadata,
	resolveDecoratorState,
} from "../../lib/decorators/decorator-state.js";
import {
	after as AFTER,
	before as BEFORE,
	controller,
	DELETE,
	GET,
	HTTP_DECORATOR_STATE_TOKEN,
	PATCH,
	POST,
	PUT,
	rollUpHttpDecoratorState,
	schema,
} from "../../lib/http/decorators.js";
import { HttpVerbs } from "../../lib/http/http-verbs.js";

describe("Decorators", () => {
	describe("Route Decorators", () => {
		it("should use default path '/' when no path is provided", () => {
			class TestController {
				@GET()
				root() {}
			}

			const state = resolveDecoratorState(
				TestController,
				HTTP_DECORATOR_STATE_TOKEN,
			);

			const routeState = state?.methods.get("root");
			expect(routeState?.paths).toEqual(["/"]);
		});

		it("should handle methods with no decorators", () => {
			class TestController {
				regularMethod() {}
			}

			const state = resolveDecoratorState(
				TestController,
				HTTP_DECORATOR_STATE_TOKEN,
			);

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

			const state = resolveDecoratorState(
				TestController,
				HTTP_DECORATOR_STATE_TOKEN,
			);

			// GET
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

			const state = resolveDecoratorState(
				TestController,
				HTTP_DECORATOR_STATE_TOKEN,
			);

			expect(state?.root.paths).toEqual(["/api"]);
		});

		it("should assign multiple paths (array) to controller", () => {
			@controller(["/api", "/v1/api"])
			class TestController {}

			const state = resolveDecoratorState(
				TestController,
				HTTP_DECORATOR_STATE_TOKEN,
			);

			expect(state?.root.paths).toEqual(["/api", "/v1/api"]);
		});

		it("should assign path from object format to controller", () => {
			@controller({ path: "/api" })
			class TestController {}

			const state = resolveDecoratorState(
				TestController,
				HTTP_DECORATOR_STATE_TOKEN,
			);

			expect(state?.root.paths).toEqual(["/api"]);
		});

		it("should assign multiple paths from object format to controller", () => {
			@controller({ path: ["/api", "/v1/api"] })
			class TestController {}

			const state = resolveDecoratorState(
				TestController,
				HTTP_DECORATOR_STATE_TOKEN,
			);

			expect(state?.root.paths).toEqual(["/api", "/v1/api"]);
		});

		it("should not modify metadata when controller has no options and no decorated methods", () => {
			@controller()
			class TestController {}

			const state = resolveDecoratorState(
				TestController,
				HTTP_DECORATOR_STATE_TOKEN,
			);

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

			const state = resolveDecoratorState(
				TestController,
				HTTP_DECORATOR_STATE_TOKEN,
			);

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

			const state = resolveDecoratorState(
				TestController,
				HTTP_DECORATOR_STATE_TOKEN,
			);

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

			const state = resolveDecoratorState(
				TestController,
				HTTP_DECORATOR_STATE_TOKEN,
			);
			const routeState = state?.methods.get("getUsers");

			expect(routeState?.schema).toEqual(testSchema);
		});
	});

	describe("rollUpHttpDecoratorState", () => {
		it("concatenates controller and method paths and preserves middleware ordering", () => {
			expect(
				rollUpHttpDecoratorState(
					{
						paths: ["/api", "/v1"],
						beforeMiddleware: ["rootBefore"],
						afterMiddleware: ["rootAfter"],
					},
					{
						paths: ["/users", "/admins"],
						beforeMiddleware: ["methodBefore"],
						afterMiddleware: ["methodAfter"],
						verbs: ["GET"],
						schema: {},
					},
				),
			).toEqual({
				paths: ["/api/users", "/api/admins", "/v1/users", "/v1/admins"],
				beforeMiddleware: ["rootBefore", "methodBefore"],
				afterMiddleware: ["methodAfter", "rootAfter"],
				verbs: ["GET"],
				schema: {},
			});
		});
	});
});

describe("decorator-state", () => {
	it("detects decorator metadata on string-keyed metadata entries and ignores invalid targets", () => {
		const metadataSymbol = Symbol.metadata ?? Symbol("Symbol.metadata");
		const target = {};

		(target as Record<symbol, unknown>)[metadataSymbol] = {
			plain: {
				methods: new Map([["getValue", { enabled: true }]]),
			},
		};

		expect(hasDecoratorMethodMetadata(target)).toBe(true);
		expect(hasDecoratorMethodMetadata(null)).toBe(false);

		(target as Record<symbol, unknown>)[metadataSymbol] = "invalid";
		expect(hasDecoratorMethodMetadata(target)).toBe(false);
	});
});
