import Ajv from "ajv";
import type { Request, Response, NextFunction } from "express";
import {
	hasValidationSchema,
	type RouteSchema,
	httpException,
} from "awilixify";

const ajv = new Ajv.default({ coerceTypes: true, removeAdditional: true });

export const createValidationMiddleware = (schema: RouteSchema) => {
	if (!hasValidationSchema(schema)) return null;

	const validate = ajv.compile({
		type: "object",
		properties: {
			...(!!schema.body && { body: schema.body }),
			...(!!schema.querystring && { querystring: schema.querystring }),
			...(!!schema.params && { params: schema.params }),
			...(!!schema.headers && { headers: schema.headers }),
		},
	});

	return (req: Request, _: Response, next: NextFunction) => {
		const valid = validate({
			body: req.body,
			querystring: req.query,
			params: req.params,
			headers: req.headers,
		});

		if (!valid) {
			const error = validate.errors?.[0];

			throw httpException.badRequest(
				error ? `${error.instancePath} ${error.message}` : "Validation error",
			);
		}

		next();
	};
};
