import { type Static, Type } from "@sinclair/typebox";
import { HttpStatus } from "awilixify";

export const GetCatsQuerySchema = Type.Object({
	breed: Type.String(),
});

const CatsServiceSchema = Type.Object({
	catsServiceId: Type.String(),
});

const GetCatsResultSchema = Type.Object({
	handlerId: Type.String(),
	catsServiceId: Type.String(),
	catsService: CatsServiceSchema,
});

export const GetCatsResponseSchema = Type.Object({
	controllerInstanceId: Type.String(),
	result: GetCatsResultSchema,
});

export const GetCatsSchema = {
	querystring: GetCatsQuerySchema,
	response: {
		[HttpStatus.OK]: GetCatsResponseSchema,
	},
};

export type CatsServiceResponse = Static<typeof CatsServiceSchema>;
export type GetCatsResult = Static<typeof GetCatsResultSchema>;
export type GetCatsQuery = Static<typeof GetCatsQuerySchema>;
export type GetCatsResponse = Static<typeof GetCatsResponseSchema>;
