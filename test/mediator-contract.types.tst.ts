import { describe, expect, it } from "tstyche";
import type { Module as M } from "../lib/di/modules/module.types.js";
import type { ModuleDef as D } from "../lib/di/modules/module-def.types.js";
import type {
	CommandContract,
	QueryContract,
} from "../lib/mediator/contract.types.js";
import { Mediator } from "../lib/mediator/mediator.js";
import type { MiddlewareContract } from "../lib/mediator/middleware.types.js";
import type { Result } from "../lib/mediator/result.js";

class LocalAuthError {
	private declare readonly __brand: "LocalAuthError";
}
class ImportedTenantError {
	private declare readonly __brand: "ImportedTenantError";
}
class CommandAuthError {
	private declare readonly __brand: "CommandAuthError";
}
class CommandPolicyError {
	private declare readonly __brand: "CommandPolicyError";
}
class HandlerCommandError {
	private declare readonly __brand: "HandlerCommandError";
}

describe("Mediator Contracts", () => {
	class AuthMiddleware {
		declare readonly contract: MiddlewareContract<
			"auth",
			Result<{ authUserId: string }, LocalAuthError>
		>;
	}

	class TraceMiddleware {
		declare readonly contract: MiddlewareContract<"trace", { traceId: string }>;
	}

	class ImportedTenantMiddleware {
		declare readonly contract: MiddlewareContract<
			"tenant",
			Result<{ tenantId: string }, ImportedTenantError>
		>;
	}

	class CommandAuthMiddleware {
		declare readonly contract: MiddlewareContract<
			"command-auth",
			Result<{ actorId: string }, CommandAuthError>
		>;
	}

	class CommandPolicyMiddleware {
		declare readonly contract: MiddlewareContract<
			"command-policy",
			Result<{ policy: "strict" }, CommandPolicyError>
		>;
	}

	type ImportedQueryModule = M<
		D<{
			queryPreHandlers: { tenant: ImportedTenantMiddleware };
			exportQueryPreHandlerKeys: ["tenant"];
		}>
	>;

	type ImportedCommandModule = M<
		D<{
			commandPreHandlers: { policy: CommandPolicyMiddleware };
			exportCommandPreHandlerKeys: ["policy"];
		}>
	>;

	type QueryModuleDef = D<{
		queryPreHandlers: { auth: AuthMiddleware; trace: TraceMiddleware };
		imports: [ImportedQueryModule];
	}>;

	type CommandModuleDef = D<{
		commandPreHandlers: { auth: CommandAuthMiddleware };
		imports: [ImportedCommandModule];
	}>;

	it("infers middleware contract requires/context tuple", () => {
		type AuthContract = MiddlewareContract<"auth", { userId: string }>;
		type TenantContract = MiddlewareContract<
			"tenant",
			{ tenantId: string },
			[AuthContract]
		>;

		expect<TenantContract["requires"]>().type.toBe<readonly ["auth"]>();
		expect<TenantContract["context"]>().type.toBeAssignableTo<{
			userId: string;
		}>();
	});

	it("infers query context and returnType from local/imported pre-handlers", () => {
		type Q = QueryContract<
			"users/get",
			{ page: number },
			{ items: string[] },
			never,
			QueryModuleDef
		>;

		expect<Q["context"]>().type.toBeAssignableTo<{
			authUserId: string;
			traceId: string;
			tenantId: string;
		}>();

		expect<Q["returnType"]>().type.toBe<
			Result<{ items: string[] }, LocalAuthError | ImportedTenantError>
		>();
	});

	it("infers command context and returnType from local/imported pre-handlers", () => {
		type C = CommandContract<
			"users/create",
			{ name: string },
			Result<{ id: string }, HandlerCommandError>,
			never,
			CommandModuleDef
		>;

		expect<C["context"]>().type.toBeAssignableTo<{
			actorId: string;
			policy: "strict";
		}>();

		expect<C["returnType"]>().type.toBe<
			Result<
				{ id: string },
				HandlerCommandError | CommandAuthError | CommandPolicyError
			>
		>();
	});

	it("infers scenario-specific return types and mediator execute options for query", () => {
		type Q = QueryContract<
			"users/get",
			{ page: number },
			{ items: string[] },
			| { name: "default" }
			| { name: "auth-only"; includePreHandlerKeys: ["auth"] },
			QueryModuleDef
		>;

		expect<Q["scenarios"]["auth-only"]["returnType"]>().type.toBe<
			Result<{ items: string[] }, LocalAuthError>
		>();

		const mediator = new Mediator<Q>(new Map(), "TypeTestModule");

		expect(
			mediator.execute("users/get", { page: 1 }, { scenario: "default" }),
		).type.toBe<
			Promise<Result<{ items: string[] }, LocalAuthError | ImportedTenantError>>
		>();

		expect(
			mediator.execute(
				"users/get",
				{ page: 1 },
				{
					scenario: "auth-only",
					includePreHandlerKeys: ["auth"] as const,
				},
			),
		).type.toBe<Promise<Result<{ items: string[] }, LocalAuthError>>>();

		expect(
			mediator.execute(
				"users/get",
				{ page: 1 },
				{
					scenario: "auth-only",
				},
			),
		).type.toRaiseError();

		expect(mediator.execute("users/get", { page: 1 })).type.toRaiseError();
	});

	it("infers scenario-specific return types and mediator execute options for command", () => {
		type C = CommandContract<
			"users/create",
			{ name: string },
			Result<{ id: string }, HandlerCommandError>,
			| { name: "auth-only"; includePreHandlerKeys: ["auth"] }
			| { name: "strict"; includePreHandlerKeys: ["auth", "policy"] },
			CommandModuleDef
		>;

		expect<C["scenarios"]["auth-only"]["returnType"]>().type.toBe<
			Result<{ id: string }, HandlerCommandError | CommandAuthError>
		>();
		expect<C["scenarios"]["strict"]["returnType"]>().type.toBe<
			Result<
				{ id: string },
				HandlerCommandError | CommandAuthError | CommandPolicyError
			>
		>();

		const mediator = new Mediator<C>(new Map(), "TypeTestModule");

		expect(
			mediator.execute(
				"users/create",
				{ name: "John" },
				{
					scenario: "strict",
					includePreHandlerKeys: ["auth", "policy"],
				},
			),
		).type.toBe<
			Promise<
				Result<
					{ id: string },
					HandlerCommandError | CommandAuthError | CommandPolicyError
				>
			>
		>();

		expect(
			mediator.execute(
				"users/create",
				{ name: "John" },
				{
					scenario: "strict",
					includePreHandlerKeys: ["auth"] as const,
				},
			),
		).type.toRaiseError();
	});

	it("keeps plain response type when no middleware returns Result", () => {
		class PlainAuthMiddleware {
			declare readonly contract: MiddlewareContract<"auth", { userId: string }>;
		}

		type PlainModuleDef = D<{
			queryPreHandlers: { auth: PlainAuthMiddleware };
		}>;

		type Q = QueryContract<
			"plain/get",
			{ id: string },
			{ payload: string },
			never,
			PlainModuleDef
		>;

		expect<Q["returnType"]>().type.toBe<{ payload: string }>();
		expect<Q["returnType"]>().type.not.toBeAssignableTo<{
			ok: boolean;
		}>();

		const mediator = new Mediator<Q>(new Map(), "TypeTestModule");

		expect(mediator.execute("plain/get", { id: "1" })).type.toBe<
			Promise<{ payload: string }>
		>();
	});
});
