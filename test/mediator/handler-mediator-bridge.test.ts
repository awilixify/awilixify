import { Lifetime } from "awilix";
import { describe, expect, it } from "vitest";
import {
	DIContext,
	type DiContextOptions,
} from "../../lib/di/contexts/di-context.js";
import * as DI_ERRORS from "../../lib/di/errors.js";
import type { AnyModule } from "../../lib/di/modules/module.types.js";
import * as MEDIATOR_ERRORS from "../../lib/mediator/errors.js";

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

describe("HandlerProcessor + Mediator bridge", () => {
	it("should register query and command mediators that execute registered handlers", async () => {
		class GetUsersQueryHandler {
			static readonly key = "get-users";

			async executor(payload: { limit: number }) {
				return { items: ["A", "B"].slice(0, payload.limit) };
			}
		}

		class CreateUserCommandHandler {
			static readonly key = "create-user";

			async executor(payload: { name: string }) {
				return { created: payload.name };
			}
		}

		const { scope } = registerModule({
			queryHandlers: [GetUsersQueryHandler],
			commandHandlers: [CreateUserCommandHandler],
		});

		const queryMediator = scope.resolve<any>("queryMediator");
		const commandMediator = scope.resolve<any>("commandMediator");

		await expect(
			queryMediator.execute("get-users", { limit: 1 }),
		).resolves.toEqual({
			items: ["A"],
		});
		await expect(
			commandMediator.execute("create-user", { name: "John" }),
		).resolves.toEqual({ created: "John" });
	});

	it("should throw when executing a handler key that is not registered", async () => {
		class GetUsersQueryHandler {
			static readonly key = "get-users";

			async executor() {
				return { ok: true };
			}
		}

		const { scope } = registerModule({
			queryHandlers: [GetUsersQueryHandler],
		});

		const queryMediator = scope.resolve<any>("queryMediator");

		await expect(queryMediator.execute("unknown-key", {})).rejects.toThrow(
			MEDIATOR_ERRORS.HandlerNotRegisteredError,
		);
	});

	it("should throw when query handler has no key", () => {
		class InvalidQueryHandler {
			async executor() {
				return { ok: true };
			}
		}

		expect(() => {
			registerModule({
				queryHandlers: [InvalidQueryHandler],
			});
		}).toThrow(DI_ERRORS.HandlerMissingStaticKeyError);
	});

	it("should throw when duplicate handler keys are registered", () => {
		class FirstQueryHandler {
			static readonly key = "get-users";

			async executor() {
				return { ok: true };
			}
		}

		class SecondQueryHandler {
			static readonly key = "get-users";

			async executor() {
				return { ok: true };
			}
		}

		expect(() => {
			registerModule({
				queryHandlers: [FirstQueryHandler, SecondQueryHandler],
			});
		}).toThrow(MEDIATOR_ERRORS.HandlerAlreadyRegisteredError);
	});

	it("should reuse singleton handler instance across executions", async () => {
		class GetUsersQueryHandler {
			static instances = 0;
			static readonly key = "get-users";
			readonly instanceId = Math.random();

			constructor() {
				GetUsersQueryHandler.instances += 1;
			}

			async executor() {
				return this.instanceId;
			}
		}

		const { scope } = registerModule({
			queryHandlers: [
				{
					useClass: GetUsersQueryHandler,
					lifetime: Lifetime.SINGLETON,
				},
			],
		});

		const queryMediator = scope.resolve<any>("queryMediator");
		const firstResult = await queryMediator.execute("get-users", {});
		const secondResult = await queryMediator.execute("get-users", {});

		expect(firstResult).toBe(secondResult);
		expect(GetUsersQueryHandler.instances).toBe(1);
	});

	it("should create handler instance per call", async () => {
		class GetUsersQueryHandler {
			static instances = 0;
			static readonly key = "get-users";
			readonly instanceId = Math.random();

			constructor() {
				GetUsersQueryHandler.instances += 1;
			}

			async executor() {
				return this.instanceId;
			}
		}

		const { scope } = registerModule({
			queryHandlers: [
				{
					useClass: GetUsersQueryHandler,
					lifetime: Lifetime.SCOPED,
				},
			],
		});

		const queryMediator = scope.resolve<any>("queryMediator");
		const firstResult = await queryMediator.execute("get-users", {});
		const secondResult = await queryMediator.execute("get-users", {});

		expect(firstResult).not.toBe(secondResult);
		expect(GetUsersQueryHandler.instances).toBe(2);
	});
});
