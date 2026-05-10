import { type Static, Type } from "@sinclair/typebox";
import { HttpStatus } from "awilixify";
import { mapErrorsToSchemas } from "@/common/base.dto.js";
import {
	CatsNotFoundError,
	LoggerError,
} from "@/common/error-to-http-error.mapper.js";
import { InvalidEventPayloadError } from "../event-emitter/event-emitter.service.js";
import { CatsViewedEvent, CatsViewedEventError } from "./cats.event.js";

export const GetCatsQuerySchema = Type.Object({
	// breed: Type.Optional(Type.String()),
	breed: Type.String(),
});

export const GetCatsParamsSchema = Type.Object({
	id: Type.Number({ minimum: 1 }),
});

const OwnersService1Schema = Type.Object({
	catsServiceId: Type.String(),
	owners1ServiceId: Type.String(),
});

const OwnersServiceSchema = Type.Object({
	catsServiceId: Type.String(),
	ownersServiceId: Type.String(),
	owners1Service: OwnersService1Schema,
});

const DogsServiceSchema = Type.Object({
	dogsServiceId: Type.String(),
	catsServiceId: Type.String(),
});

const CatsServiceSchema = Type.Object({
	catsServiceId: Type.String(),
	dogsServiceId: Type.String(),
	ownersServiceId: Type.String(),
	ownersService1Id: Type.String(),
	ownersService: OwnersServiceSchema,
	dogsService: DogsServiceSchema,
});

const GetCatsRespsonseResultSchema = Type.Object({
	handlerId: Type.String(),
	catsServiceId: Type.String(),
	dogsServiceId: Type.String(),
	dogsService: DogsServiceSchema,
	catsService: CatsServiceSchema,
});

export const GetCatsResponseSchema = Type.Object({
	controllerInstanceId: Type.String(),
	result: GetCatsRespsonseResultSchema,
});

export const GetCatsSchema = {
	params: GetCatsParamsSchema,
	querystring: GetCatsQuerySchema,
	response: {
		[HttpStatus.OK]: GetCatsResponseSchema,
		...mapErrorsToSchemas([
			CatsNotFoundError,
			LoggerError,
			InvalidEventPayloadError,
			CatsViewedEventError,
		]),
	},
};

export type DogsServiceResponse = Static<typeof DogsServiceSchema>;
export type CatsServiceResponse = Static<typeof CatsServiceSchema>;

export type GetCatsResult = Static<typeof GetCatsRespsonseResultSchema>;

export type GetCatsParams = Static<typeof GetCatsParamsSchema>;
export type GetCatsQuery = Static<typeof GetCatsQuerySchema>;
export type GetCatsResponse = Static<typeof GetCatsResponseSchema>;
