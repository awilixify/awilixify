import type { QueryContract, Handler } from "awilixify";
import type {
	GetOwnersQuery as Payload,
	GetOwnersResponse as Response,
} from "./get-owners.dto.js";

export class GetOwnersQueryHandler
	implements Handler<GetOwnersQueryHandler["contract"]>
{
	static readonly key = "owners/get-owners";
	declare readonly contract: QueryContract<
		typeof GetOwnersQueryHandler.key,
		Payload,
		Response
	>;

	private readonly instanceId = Math.random().toString(36).substring(7);

	async executor(payload: Payload): Promise<Response> {
		return {
			handlerId: this.instanceId,
		};
	}
}
