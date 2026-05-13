import { type Middleware, type MiddlewareContract, Result } from "awilixify";
import { UnauthorizedError } from "@/common/error-to-http-error.mapper.js";

type ReturnType = Result<
	{ userId: string; roles: string[] },
	UnauthorizedError
>;
type Contract = MiddlewareContract<typeof CatsAuthMiddleware.key, ReturnType>;

export class CatsAuthMiddleware implements Middleware<Contract> {
	static readonly key = "auth";

	declare readonly contract: Contract;

	async execute(
		payload: unknown,
		context: Contract["context"], // = {}
		executionContext: Contract["executionContext"],
	): Promise<ReturnType> {
		// Read from executionContext (immutable, from HTTP layer)
		const token = executionContext.token;

		// console.log("-------------------AUTH--------------------------");

		// Simulate token verification
		if (!token || token === "invalid") {
			// Return error - type checked via unique error code
			// return Result.error(new UnauthorizedError());
		}

		// In real app: verify JWT token
		// const user = await verifyJWT(token);
		const mockUser = {
			userId: "cats-user-456",
			roles: ["cat-admin", "user"],
		};

		// Return success
		return Result.ok(mockUser);
	}
}
