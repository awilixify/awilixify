# App Error to HTTP Error Mapping

Use one central app-error map and reuse it in both runtime response mapping and DTO response schemas.

### Why this is useful

- OpenAPI/Swagger documents every declared error response per route.
- Pre-handler errors are included too, so middleware-level failures are not missed in Swagger.
- Runtime response mapping and documented schemas stay in sync from one source of truth.
- Exhaustive `Record<ErrorCode, ...>` mapping prevents unmapped application errors at compile time.
- Error payloads are status-aware and strongly typed (`message` + `statusCode` literals).
- Adding a new error forces you to wire mapping and schema intentionally.

### 1. Base application error

`base.error.ts`

```ts
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
```

### 2. Central error -> HttpException mapper

`error-to-http-error.mapper.ts`

```ts
import { httpException, HttpException } from "awilixify";
import { BaseError } from "./base.error.js";

export class UnauthorizedError extends BaseError {
  static readonly CODE = "auth.unauthorized";
  readonly code = UnauthorizedError.CODE;
}

export class TenantNotFoundError extends BaseError {
  static readonly CODE = "tenant.not_found";
  readonly code = TenantNotFoundError.CODE;
}

export const Errors = {
  TENANT_NOT_FOUND: TenantNotFoundError,
  UNAUTHORIZED: UnauthorizedError,
} as const;

export type ErrorCode = (typeof Errors)[keyof typeof Errors]["CODE"];

const errorCodeToHttpException = {
  [Errors.UNAUTHORIZED.CODE]: () =>
    httpException.unauthorized(Errors.UNAUTHORIZED.CODE),
  [Errors.TENANT_NOT_FOUND.CODE]: () =>
    httpException.notFound(Errors.TENANT_NOT_FOUND.CODE),
} as const satisfies Record<ErrorCode, () => HttpException<string>>;

export function mapApplicationErrorToHttpError<TError extends BaseError>(
  error: TError,
): ReturnType<(typeof errorCodeToHttpException)[TError["code"]]> {
  return errorCodeToHttpException[error.code]() as ReturnType<
    (typeof errorCodeToHttpException)[TError["code"]]
  >;
}
```

`Record<ErrorCode, ...>` guarantees exhaustive mapping at compile time.

### 3. Typed schema builder from error classes

`base.dto.ts`

```ts
import { Type } from "@sinclair/typebox";
import { HttpStatus } from "awilixify";
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

type ExtractStatus<T extends BaseErrorClass> = ReturnType<
  (typeof errorCodeToHttpException)[T["CODE"]]
>["statusCode"];

type FilterByStatus<
  Errors extends BaseErrorClass,
  Status extends HttpStatus,
> = Errors extends BaseErrorClass
  ? ExtractStatus<Errors> extends Status
    ? Errors
    : never
  : never;

type UnionOfLiterals<T extends string> = T extends any
  ? ReturnType<typeof Type.Literal<T>>
  : never;

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

type ErrorSchemasRecord<T extends readonly BaseErrorClass[]> = {
  [Status in ExtractStatus<T[number]>]: BuildSchemaForStatus<T[number], Status>;
};

const DEFAULT_ERROR_CLASSES = [UnauthorizedError, TenantNotFoundError] as const;

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
        message: Type.Union(errorClasses.map((e) => Type.Literal(e.CODE))),
        statusCode: Type.Literal(statusCode),
      });

      return [statusCode, schema] as const;
    },
  );

  return Object.fromEntries(schemas) as unknown as ErrorSchemasRecord<T>;
}

export function mapErrorsToSchemas<const T extends readonly BaseErrorClass[]>(
  errors: T,
): ErrorSchemasRecord<[...typeof DEFAULT_ERROR_CLASSES, ...T]> {
  return buildSchemas([...DEFAULT_ERROR_CLASSES, ...errors]);
}
```

### 4. Use in DTO response schema

`get-cats.dto.ts`

```ts
import { Type } from "@sinclair/typebox";
import { HttpStatus } from "awilixify";
import { mapErrorsToSchemas } from "@/common/base.dto.js";
import {
  CatsNotFoundError,
  LoggerError,
} from "@/common/error-to-http-error.mapper.js";

export const GetCatsSchema = {
  response: {
    [HttpStatus.OK]: Type.Object({
      controllerInstanceId: Type.String(),
    }),
    ...mapErrorsToSchemas([CatsNotFoundError, LoggerError]),
  },
};
```

Now your OpenAPI/runtime response schema is derived from the same error source of truth.

### 5. Use in controller boundary

`cats.controller.ts`

```ts
if (!result.ok) {
  const httpError = mapApplicationErrorToHttpError(result.error);
  return res.status(httpError.statusCode).send(httpError.getResponse());
}
```
