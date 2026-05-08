import { type Handler, type QueryContract, Result } from "awilix-modular";
import { CatsNotFoundError } from "@/common/error-to-http-error.mapper.js";
import type { CatsModuleDef, Deps } from "./cats.module.js";
import type {
	GetCatsQuery as Payload,
	GetCatsResult as SuccessResponse,
} from "./get-cats.dto.js";

// Handler defines ONLY its own error type
type Response = Result<SuccessResponse, CatsNotFoundError>;
// type Response = SuccessResponse;

export class GetCatsQueryHandler
	implements Handler<GetCatsQueryHandler["contract"]>
{
	static readonly key = "cats/get-cats";
	declare readonly contract: QueryContract<
		typeof GetCatsQueryHandler.key,
		Payload,
		Response,
		| { name: "auth-logging"; includePreHandlerKeys: ["auth", "logging"] }
		| { name: "default" }
		| { name: "logging-tenant"; includePreHandlerKeys: ["logging", "tenant"] },
		CatsModuleDef
	>;
	declare readonly context: this["contract"]["context"];

	private readonly instanceId = Math.random().toString(36).substring(7);

	constructor(
		private readonly catsService: Deps["catsService"],
		private readonly dogsService: Deps["dogsService"],
		private readonly interceptedCatsService: Deps["interceptedCatsService"],
	) {}

	async executor(
		_payload: Payload,
		context: this["context"],
	): Promise<Response> {
		console.log(context, "CONTExt");
		const { userId, roles } = this.normalizeContext(context);

		// context is auto-typed from module's queryPreHandlers
		// You get autocomplete for: context.userId, context.roles
		console.log(
			`[GetCatsQueryHandler] User ${userId} with roles ${roles.join(", ")}`,
		);

		const cats = await this.catsService.getCats();

		// console.log(cats, "cats");

		// return {
		// 	handlerId: this.instanceId,
		// 	dogsServiceId: this.dogsService.getInstanceId(),
		// 	catsServiceId: this.catsService.getInstanceId(),
		// 	dogsService: this.dogsService.getDogs(),
		// 	catsService: cats,
		// };

		if (!cats || userId === "no-cats-user") {
			console.log(`[GetCatsQueryHandler] No cats found for user ${userId}`);
			// Return error - this is the ONLY error the handler defines
			return Result.error(new CatsNotFoundError(userId));
		}

		// Return success
		return Result.ok({
			handlerId: this.instanceId,
			dogsServiceId: this.dogsService.getInstanceId(),
			catsServiceId: this.catsService.getInstanceId(),
			dogsService: this.dogsService.getDogs(),
			catsService: cats,
		});
	}

	private normalizeContext(context: this["context"]): {
		userId: string;
		roles: string[];
	} {
		return {
			userId: this.hasUserId(context) ? context.userId : "anonymous",
			roles: this.hasRoles(context) ? context.roles : [],
		};
	}

	private hasRoles(
		context: this["context"],
	): context is this["context"] & { roles: string[] } {
		return (
			"roles" in context &&
			Array.isArray((context as { roles?: unknown }).roles)
		);
	}

	private hasUserId(
		context: this["context"],
	): context is this["context"] & { userId: string } {
		return (
			"userId" in context &&
			typeof (context as { userId?: unknown }).userId === "string"
		);
	}
}
