import { Type } from "@sinclair/typebox";
import { HttpStatus } from "awilixify/http";

import { BaseError } from "./base.error.js";
import {
	errorCodeToHttpException,
	UnauthorizedError,
	TenantNotFoundError,
} from "./error-to-http-error.mapper.js";

type BaseErrorClass = {
	new (...args: any[]): BaseError;
	readonly CODE: keyof typeof errorCodeToHttpException;
};

type MapErrorsOptions = {
	skipNotAuthorized?: boolean;
	skipWhiteLabelNoFound?: boolean;
};

const DEFAULT_ERROR_CLASSES = [UnauthorizedError, TenantNotFoundError] as const;

type DefaultErrorClasses = typeof DEFAULT_ERROR_CLASSES;

type ResolveDefaultErrorsByOptions<O extends MapErrorsOptions | undefined> = [
	...(O extends { skipNotAuthorized: true } ? [] : [DefaultErrorClasses[0]]),
	...(O extends { skipWhiteLabelNoFound: true }
		? []
		: [DefaultErrorClasses[1]]),
];

// Helper type to extract status code from an error class
type ExtractStatus<T extends BaseErrorClass> = ReturnType<
	(typeof errorCodeToHttpException)[T["CODE"]]
>["statusCode"];

// Helper to filter errors by status code
type FilterByStatus<
	Errors extends BaseErrorClass,
	Status extends HttpStatus,
> = Errors extends BaseErrorClass
	? ExtractStatus<Errors> extends Status
		? Errors
		: never
	: never;

// Convert union of codes to union of TLiteral types
type UnionOfLiterals<T extends string> = T extends any
	? ReturnType<typeof Type.Literal<T>>
	: never;

// Helper to build schema for a single status code
type BuildSchemaForStatus<
	AllErrors extends BaseErrorClass,
	Status extends HttpStatus,
> =
	FilterByStatus<AllErrors, Status> extends infer Filtered extends
		BaseErrorClass
		? Filtered["CODE"] extends infer Codes extends string
			? ReturnType<
					typeof Type.Object<{
						message: UnionOfLiterals<Codes>;
						statusCode: ReturnType<typeof Type.Literal<Status>>;
					}>
				>
			: never
		: never;

// Main type for the result
type ErrorSchemasRecord<T extends readonly BaseErrorClass[]> = {
	[Status in ExtractStatus<T[number]>]: BuildSchemaForStatus<T[number], Status>;
};

function buildSchemas<T extends readonly BaseErrorClass[]>(
	errors: T,
): ErrorSchemasRecord<T> {
	const groupedByStatus = errors.reduce((acc, ErrorClass) => {
		const status = errorCodeToHttpException[ErrorClass.CODE]().statusCode;
		acc.set(status, [...(acc.get(status) ?? []), ErrorClass]);

		return acc;
	}, new Map<HttpStatus, BaseErrorClass[]>());

	const schemas = Array.from(groupedByStatus.entries()).map(
		([statusCode, errorClasses]) => {
			const schema = Type.Object({
				message: Type.Union(
					errorClasses.map((e) => Type.Literal(e.CODE)),
					{ default: errorClasses.map((e) => e.CODE).join(" | ") },
				),
				statusCode: Type.Literal(statusCode, { default: statusCode }),
			});

			return [statusCode, schema] as const;
		},
	);

	return Object.fromEntries(schemas) as unknown as ErrorSchemasRecord<T>;
}

function resolveDefaultErrors(
	options: MapErrorsOptions,
): readonly BaseErrorClass[] {
	const defaults: BaseErrorClass[] = [];

	if (!options.skipNotAuthorized) {
		defaults.push(UnauthorizedError);
	}

	if (!options.skipWhiteLabelNoFound) {
		defaults.push(TenantNotFoundError);
	}

	return defaults;
}

// By default includes NotAuthorizedError and WhiteLabelNoFoundError.
export function mapErrorsToSchemas<const T extends readonly BaseErrorClass[]>(
	errors: T,
): ErrorSchemasRecord<[...typeof DEFAULT_ERROR_CLASSES, ...T]>;

export function mapErrorsToSchemas<
	const T extends readonly BaseErrorClass[],
	const O extends MapErrorsOptions,
>(
	errors: T,
	options: O,
): ErrorSchemasRecord<[...ResolveDefaultErrorsByOptions<O>, ...T]>;

export function mapErrorsToSchemas(
	errors: readonly BaseErrorClass[],
	options: MapErrorsOptions = {},
): ErrorSchemasRecord<readonly BaseErrorClass[]> {
	const merged = [...resolveDefaultErrors(options), ...errors];

	return buildSchemas(merged);
}
