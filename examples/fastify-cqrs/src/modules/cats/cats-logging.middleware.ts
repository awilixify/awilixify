import {
	type Middleware,
	type MiddlewareContract,
	Result,
} from "awilix-modular";
import { LoggerError } from "@/common/error-to-http-error.mapper.js";
import type { CatsAuthMiddleware } from "./cats-auth.middleware.js";

type ReturnType = Result<{ loggerId: string }, LoggerError>;
type Contract = MiddlewareContract<
	typeof CatsLoggingMiddleware.key,
	ReturnType,
	[CatsAuthMiddleware["contract"]]
>;

export class CatsLoggingMiddleware implements Middleware<Contract> {
	static readonly key = "logging";
	readonly requires = ["auth"] as const;

	declare readonly contract: Contract;

	async execute(
		payload: unknown,
		context: Contract["context"],
		executionContext: Contract["executionContext"],
	): Promise<ReturnType> {
		// Read from executionContext (immutable, from HTTP layer)
		const token = executionContext.token;
		const t = context.userId;

		// console.log("--------------LOGGING--------------------");
		// console.log(`User: ${context.userId}, Roles: ${context.roles.join(", ")}`);
		//
		// if (!token || token === "invalid") {
		// 	return Result.error(new LoggerError());
		// }

		// Return success
		return Result.ok({ loggerId: "LoggerId" });
	}
}
