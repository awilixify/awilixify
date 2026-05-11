import { type Static, Type } from "@sinclair/typebox";
import { HttpStatus } from "awilixify/http";

export const GetOwnersQuerySchema = Type.Object({
	name: Type.String(),
});

const GetOwnersResponseSchema = Type.Object({
	handlerId: Type.String(),
});

export const GetOwnersSchema = {
	querystring: GetOwnersQuerySchema,
	response: {
		[HttpStatus.OK]: GetOwnersResponseSchema,
	},
};
export type GetOwnersQuery = Static<typeof GetOwnersQuerySchema>;
export type GetOwnersResponse = Static<typeof GetOwnersResponseSchema>;
