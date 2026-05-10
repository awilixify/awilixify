import { httpException, HttpException } from "awilixify";

import { BaseError } from "./base.error.js";
import { CatsViewedEventError } from "@/modules/cats/cats.event-listeners.js";
import { InvalidEventPayloadError } from "@/modules/event-emitter/event-emitter.service.js";
import { InvalidQueueJobPayloadError } from "@/modules/queue/queue.service.js";

export class UnauthorizedError extends BaseError {
	static readonly CODE = "auth.unauthorized";
	readonly code = UnauthorizedError.CODE;

	constructor(message = "Unauthorized - invalid or missing token") {
		super(message);
		this.name = "UnauthorizedError";
	}
}

export class TenantNotFoundError extends BaseError {
	static readonly CODE = "tenant.not_found";
	readonly code = TenantNotFoundError.CODE;

	constructor(public readonly userId: string) {
		super(`Tenant not found for user ${userId}`);
		this.name = "TenantNotFoundError";
	}
}

export class LoggerError extends BaseError {
	static readonly CODE = "logger.not_found";
	readonly code = LoggerError.CODE;

	constructor() {
		super(`Something wrong with logger`);
		this.name = "LoggerError";
	}
}

export class CatsNotFoundError extends BaseError {
	static readonly CODE = "cats.not_found";
	readonly code = CatsNotFoundError.CODE;

	constructor(public readonly tenantId: string) {
		super(`No cats found for tenant ${tenantId}`);
		this.name = "CatsNotFoundError";
	}
}

export const Errors = {
	LOGGER_NOT_FOUND: LoggerError,
	TENANT_NOT_FOUND: TenantNotFoundError,
	CATS_NOT_FOUND: CatsNotFoundError,
	UNAUTHORIZED: UnauthorizedError,
	CATS_VIEWED_EVENT_EMIT_FAILED: CatsViewedEventError,
	INVALID_EVENT_PAYLOAD_ERROR: InvalidEventPayloadError,
	INVALID_QUEUE_JOB_PAYLOAD_ERROR: InvalidQueueJobPayloadError,
} as const;

export type ErrorCode = (typeof Errors)[keyof typeof Errors]["CODE"];

export const errorCodeToHttpException = {
	[Errors.UNAUTHORIZED.CODE]: () =>
		httpException.unauthorized(Errors.UNAUTHORIZED.CODE),
	[Errors.TENANT_NOT_FOUND.CODE]: () =>
		httpException.notFound(Errors.TENANT_NOT_FOUND.CODE),
	[Errors.CATS_NOT_FOUND.CODE]: () =>
		httpException.notFound(Errors.CATS_NOT_FOUND.CODE),
	[Errors.LOGGER_NOT_FOUND.CODE]: () =>
		httpException.notFound(Errors.LOGGER_NOT_FOUND.CODE),
	[Errors.CATS_VIEWED_EVENT_EMIT_FAILED.CODE]: () =>
		httpException.internalServerError(
			Errors.CATS_VIEWED_EVENT_EMIT_FAILED.CODE,
		),
	[Errors.INVALID_EVENT_PAYLOAD_ERROR.CODE]: () =>
		httpException.badRequest(Errors.INVALID_EVENT_PAYLOAD_ERROR.CODE),
	[Errors.INVALID_QUEUE_JOB_PAYLOAD_ERROR.CODE]: () =>
		httpException.badRequest(Errors.INVALID_QUEUE_JOB_PAYLOAD_ERROR.CODE),
} as const satisfies Record<ErrorCode, () => HttpException<string>>;

export function mapApplicationErrorToHttpError<TError extends BaseError>(
	error: TError,
): ReturnType<(typeof errorCodeToHttpException)[TError["code"]]> {
	return errorCodeToHttpException[error.code]() as ReturnType<
		(typeof errorCodeToHttpException)[TError["code"]]
	>;
}
