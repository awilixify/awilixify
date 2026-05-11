export enum HttpStatus {
	OK = 200,
	CREATED = 201,
	BAD_REQUEST = 400,
	UNAUTHORIZED = 401,
	FORBIDDEN = 403,
	NOT_FOUND = 404,
	METHOD_NOT_ALLOWED = 405,
	NOT_ACCEPTABLE = 406,
	REQUEST_TIMEOUT = 408,
	CONFLICT = 409,
	GONE = 410,
	PRECONDITION_FAILED = 412,
	PAYLOAD_TOO_LARGE = 413,
	UNSUPPORTED_MEDIA_TYPE = 415,
	I_AM_A_TEAPOT = 418,
	UNPROCESSABLE_ENTITY = 422,
	INTERNAL_SERVER_ERROR = 500,
	NOT_IMPLEMENTED = 501,
	BAD_GATEWAY = 502,
	SERVICE_UNAVAILABLE = 503,
	GATEWAY_TIMEOUT = 504,
	HTTP_VERSION_NOT_SUPPORTED = 505,
}

export class HttpException<
	TMessage extends string,
	TStatus extends HttpStatus = HttpStatus,
> extends Error {
	constructor(
		public readonly message: TMessage,
		public readonly statusCode: TStatus,
		public readonly response?: Record<string, any> | null,
	) {
		super(message);
		this.name = this.constructor.name;
		Error.captureStackTrace(this, this.constructor);
	}

	getResponse(): {
		message: TMessage;
		statusCode: TStatus;
		[key: string]: any;
	} {
		return {
			message: this.message,
			statusCode: this.statusCode,
			...this.response,
		};
	}

	getStatus(): TStatus {
		return this.statusCode;
	}
}

const createFactory =
	<TDefault extends string, TStatus extends HttpStatus>(
		defaultMessage: TDefault,
		status: TStatus,
	) =>
	<M extends string = TDefault>(message?: M, response?: Record<string, any>) =>
		new HttpException(
			(message ?? defaultMessage) as M extends undefined ? TDefault : M,
			status,
			response,
		);

export const httpException = {
	badRequest: createFactory("Bad Request", HttpStatus.BAD_REQUEST),
	unauthorized: createFactory("Unauthorized", HttpStatus.UNAUTHORIZED),
	forbidden: createFactory("Forbidden", HttpStatus.FORBIDDEN),
	notFound: createFactory("Not Found", HttpStatus.NOT_FOUND),
	methodNotAllowed: createFactory(
		"Method Not Allowed",
		HttpStatus.METHOD_NOT_ALLOWED,
	),
	notAcceptable: createFactory("Not Acceptable", HttpStatus.NOT_ACCEPTABLE),
	requestTimeout: createFactory("Request Timeout", HttpStatus.REQUEST_TIMEOUT),
	conflict: createFactory("Conflict", HttpStatus.CONFLICT),
	gone: createFactory("Gone", HttpStatus.GONE),
	preconditionFailed: createFactory(
		"Precondition Failed",
		HttpStatus.PRECONDITION_FAILED,
	),
	payloadTooLarge: createFactory(
		"Payload Too Large",
		HttpStatus.PAYLOAD_TOO_LARGE,
	),
	unsupportedMediaType: createFactory(
		"Unsupported Media Type",
		HttpStatus.UNSUPPORTED_MEDIA_TYPE,
	),
	imATeapot: createFactory("I'm a teapot", HttpStatus.I_AM_A_TEAPOT),
	unprocessableEntity: createFactory(
		"Unprocessable Entity",
		HttpStatus.UNPROCESSABLE_ENTITY,
	),
	internalServerError: createFactory(
		"Internal Server Error",
		HttpStatus.INTERNAL_SERVER_ERROR,
	),
	notImplemented: createFactory("Not Implemented", HttpStatus.NOT_IMPLEMENTED),
	badGateway: createFactory("Bad Gateway", HttpStatus.BAD_GATEWAY),
	serviceUnavailable: createFactory(
		"Service Unavailable",
		HttpStatus.SERVICE_UNAVAILABLE,
	),
	gatewayTimeout: createFactory("Gateway Timeout", HttpStatus.GATEWAY_TIMEOUT),
	httpVersionNotSupported: createFactory(
		"HTTP Version Not Supported",
		HttpStatus.HTTP_VERSION_NOT_SUPPORTED,
	),
};
