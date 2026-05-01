import {
	type Middleware,
	type MiddlewareContract,
	Result,
} from "awilix-modular";
import { TenantNotFoundError } from "@/common/error-to-http-error.mapper.js";

type ReturnType = Result<
	{ tenantId: string; tenantName: string },
	TenantNotFoundError
>;

export class TenantMiddleware implements Middleware {
	static readonly key = "tenant";
	declare readonly contract: MiddlewareContract<
		typeof TenantMiddleware.key,
		ReturnType
	>;

	async execute(
		payload: unknown,
		context: this["contract"]["context"],
		executionContext: this["contract"]["executionContext"],
	): Promise<ReturnType> {
		// Simulate tenant lookup from context or executionContext
		const userId = (context as any).userId || "unknown";

		console.log("--------TENANT--------------");

		// Simulate tenant not found scenario
		if (userId === "user-without-tenant") {
			console.log(
				`[Tenant Middleware] No tenant found for user ${userId} - returning error`,
			);
			return Result.error(new TenantNotFoundError(userId));
		}

		// In a real app, you'd extract tenant from subdomain or header in executionContext
		const mockTenant = {
			tenantId: "tenant-456",
			tenantName: "Acme Corp",
		};

		console.log(
			"[Tenant Middleware] Adding tenant to context:",
			mockTenant.tenantName,
		);

		return Result.ok(mockTenant);
	}
}
