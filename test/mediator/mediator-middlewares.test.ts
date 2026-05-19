import { Lifetime } from "awilix";
import { describe, expect, it } from "vitest";
import {
	DIContext,
	type DiContextOptions,
} from "../../lib/di/contexts/di-context.js";
import type { AnyModule } from "../../lib/di/modules/module.types.js";
import * as MEDIATOR_ERRORS from "../../lib/mediator/errors.js";
import { Result } from "../../lib/mediator/result.js";

function registerModule(
	module: Partial<AnyModule>,
	options?: Partial<DiContextOptions>,
) {
	return DIContext.create(
		{
			name: "TestModule",
			...module,
		},
		{
			...options,
		},
	);
}

describe("Mediator middleware scenarios", () => {
	it("should execute middlewares in declaration order and pass merged context to handler", async () => {
		const calls: string[] = [];

		class AuthMiddleware {
			async execute() {
				calls.push("auth");
				return { userId: "u-1" };
			}
		}

		class TenantMiddleware {
			readonly requires = ["auth"];

			async execute() {
				calls.push("tenant");
				return { tenantId: "t-1" };
			}
		}

		class GetDataHandler {
			static readonly key = "get-data";

			async executor(_: unknown, context: any) {
				calls.push("handler");
				return `${context.userId}:${context.tenantId}`;
			}
		}

		const { scope } = registerModule({
			queryHandlers: [GetDataHandler],
			queryPreHandlers: {
				auth: AuthMiddleware,
				tenant: TenantMiddleware,
			},
		});

		const queryMediator = scope.resolve<any>("queryMediator");
		const response = await queryMediator.execute("get-data", {});

		expect(response).toBe("u-1:t-1");
		expect(calls).toEqual(["auth", "tenant", "handler"]);
	});

	it("should apply includePreHandlerKeys and fail when middleware requirements are not satisfied", async () => {
		class AuthMiddleware {
			async execute() {
				return { userId: "u-1" };
			}
		}

		class TenantMiddleware {
			readonly requires = ["auth"];

			async execute() {
				return { tenantId: "t-1" };
			}
		}

		class GetDataHandler {
			static readonly key = "get-data";

			async executor() {
				return { ok: true };
			}
		}

		const { scope } = registerModule({
			queryHandlers: [GetDataHandler],
			queryPreHandlers: {
				auth: AuthMiddleware,
				tenant: TenantMiddleware,
			},
		});

		const queryMediator = scope.resolve<any>("queryMediator");

		await expect(
			queryMediator.execute(
				"get-data",
				{},
				{ includePreHandlerKeys: ["tenant"] },
			),
		).rejects.toThrow(MEDIATOR_ERRORS.MiddlewareRequiredError);
	});

	it("should apply excludePreHandlerKeys and skip excluded middleware", async () => {
		const calls: string[] = [];

		class AuthMiddleware {
			async execute() {
				calls.push("auth");
				return { userId: "u-1" };
			}
		}

		class TenantMiddleware {
			async execute() {
				calls.push("tenant");
				return { tenantId: "t-1" };
			}
		}

		class GetDataHandler {
			static readonly key = "get-data";

			async executor(_: unknown, context: any) {
				calls.push("handler");
				return `${context.userId ?? "none"}:${context.tenantId}`;
			}
		}

		const { scope } = registerModule({
			queryHandlers: [GetDataHandler],
			queryPreHandlers: {
				auth: AuthMiddleware,
				tenant: TenantMiddleware,
			},
		});

		const queryMediator = scope.resolve<any>("queryMediator");
		const response = await queryMediator.execute(
			"get-data",
			{},
			{ excludePreHandlerKeys: ["auth"] },
		);

		expect(response).toBe("none:t-1");
		expect(calls).toEqual(["tenant", "handler"]);
	});

	it("should short-circuit handler execution when middleware returns Result.error", async () => {
		class AuthMiddleware {
			async execute() {
				return Result.error("unauthorized");
			}
		}

		class GetDataHandler {
			static readonly key = "get-data";

			async executor() {
				throw new Error("handler must not run");
			}
		}

		const { scope } = registerModule({
			queryHandlers: [GetDataHandler],
			queryPreHandlers: {
				auth: AuthMiddleware,
			},
		});

		const queryMediator = scope.resolve<any>("queryMediator");
		const response = await queryMediator.execute("get-data", {});

		expect(response).toEqual(Result.error("unauthorized"));
	});

	it("should wrap handler response into Result.ok when middleware returns Result.ok", async () => {
		class AuthMiddleware {
			async execute() {
				return Result.ok({ userId: "u-1" });
			}
		}

		class GetDataHandler {
			static readonly key = "get-data";

			async executor() {
				return "plain-handler-result";
			}
		}

		const { scope } = registerModule({
			queryHandlers: [GetDataHandler],
			queryPreHandlers: {
				auth: AuthMiddleware,
			},
		});

		const queryMediator = scope.resolve<any>("queryMediator");
		const response = await queryMediator.execute("get-data", {});

		expect(response).toEqual(Result.ok("plain-handler-result"));
	});

	it("should throw when middleware returns a non-object non-result value", async () => {
		class InvalidMiddleware {
			async execute() {
				return "bad-value";
			}
		}

		class GetDataHandler {
			static readonly key = "get-data";

			async executor() {
				return { ok: true };
			}
		}

		const { scope } = registerModule({
			queryHandlers: [GetDataHandler],
			queryPreHandlers: {
				invalid: InvalidMiddleware,
			},
		});

		const queryMediator = scope.resolve<any>("queryMediator");

		await expect(queryMediator.execute("get-data", {})).rejects.toThrow(
			MEDIATOR_ERRORS.InvalidMiddlewareReturnValueError,
		);
	});

	it("should keep current context when middleware returns undefined", async () => {
		class EmptyMiddleware {
			async execute() {}
		}

		class AuthMiddleware {
			async execute() {
				return { userId: "u-1" };
			}
		}

		class GetDataHandler {
			static readonly key = "get-data";

			async executor(_: unknown, context: any) {
				return context;
			}
		}

		const { scope } = registerModule({
			queryHandlers: [GetDataHandler],
			queryPreHandlers: {
				empty: EmptyMiddleware,
				auth: AuthMiddleware,
			},
		});

		const queryMediator = scope.resolve<any>("queryMediator");
		const response = await queryMediator.execute("get-data", {});

		expect(response).toStrictEqual({ userId: "u-1" });
	});

	it("should throw when middleware context keys conflict", async () => {
		class AuthMiddleware {
			async execute() {
				return { userId: "u-1" };
			}
		}

		class DuplicateAuthMiddleware {
			async execute() {
				return { userId: "u-2" };
			}
		}

		class GetDataHandler {
			static readonly key = "get-data";

			async executor() {
				return { ok: true };
			}
		}

		const { scope } = registerModule({
			queryHandlers: [GetDataHandler],
			queryPreHandlers: {
				auth: AuthMiddleware,
				duplicateAuth: DuplicateAuthMiddleware,
			},
		});

		const queryMediator = scope.resolve<any>("queryMediator");

		await expect(queryMediator.execute("get-data", {})).rejects.toThrow(
			MEDIATOR_ERRORS.ContextKeyConflictError,
		);
	});

	it("should reuse imported exported singleton middleware instance across executions", async () => {
		class ImportedAuthMiddleware {
			static instances = 0;
			readonly instanceId = Math.random();

			constructor() {
				ImportedAuthMiddleware.instances += 1;
			}

			async execute() {
				return { middlewareInstanceId: this.instanceId };
			}
		}

		class GetDataHandler {
			static readonly key = "get-data";

			async executor(_: unknown, context: any) {
				return context.middlewareInstanceId;
			}
		}

		const sharedModule: AnyModule = {
			name: "SharedMiddlewareModule",
			queryPreHandlers: {
				auth: {
					useClass: ImportedAuthMiddleware,
					lifetime: Lifetime.SINGLETON,
				},
			},
			queryPreHandlerExports: ["auth"],
		};

		const { scope } = registerModule({
			imports: [sharedModule],
			queryHandlers: [GetDataHandler],
		});

		const queryMediator = scope.resolve<any>("queryMediator");
		const firstResult = await queryMediator.execute("get-data", {});
		const secondResult = await queryMediator.execute("get-data", {});

		expect(firstResult).toBe(secondResult);
		expect(ImportedAuthMiddleware.instances).toBe(1);
	});
});
