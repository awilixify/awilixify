import type { ErrorCode } from "./error-to-http-error.mapper.js";

export abstract class BaseError extends Error {
	abstract readonly code: ErrorCode;

	readonly metadata?: Record<string, unknown>;

	constructor(message: string, metadata?: Record<string, unknown>) {
		super(message);
		this.name = this.constructor.name;
		this.metadata = metadata;
		Error.captureStackTrace(this, this.constructor);
	}
}
