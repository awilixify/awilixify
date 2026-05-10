import type { Request, Response, NextFunction } from "express";
import { HttpException, HttpStatus } from "awilixify";

export function errorHandler(
	err: Error,
	_: Request,
	res: Response,
	__: NextFunction,
) {
	if (err instanceof HttpException) {
		return res.status(err.getStatus()).json({
			...err.getResponse(),
		});
	}

	res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
		message: err.message || "Internal Server Error",
		statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
	});
}
