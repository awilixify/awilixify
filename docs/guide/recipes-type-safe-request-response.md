# Type-Safe Request/Response

When using route schemas with TypeBox or JSON Schema, you can create type-safe Request and Response types that automatically infer types from your schemas. This provides full TypeScript autocomplete and type checking for route parameters, query strings, request bodies, and responses.

### Express Type Safety

Create custom Request and Response types that extract TypeScript types from your route schemas:

```typescript
import type {
  Request as ExpressRequest,
  Response as ExpressResponse,
} from "express";
import type { Static, TSchema } from "@sinclair/typebox";
import type { RouteSchema } from "awilixify";

export type Request<S extends RouteSchema> = ExpressRequest<
  S["params"] extends TSchema ? Static<S["params"]> : any,
  any,
  S["body"] extends TSchema ? Static<S["body"]> : any,
  S["querystring"] extends TSchema ? Static<S["querystring"]> : any
>;

export type Response<S extends RouteSchema> = Omit<
  ExpressResponse,
  "status" | "json" | "send"
> & {
  status<Code extends keyof S["response"] & number>(
    code: Code,
  ): Omit<ExpressResponse, "json" | "send"> & {
    json(body: ResponseBodyForStatus<S, Code>): ExpressResponse;
    send(body: ResponseBodyForStatus<S, Code>): ExpressResponse;
  };
  json(
    body: 200 extends keyof S["response"] ? ResponseBodyForStatus<S, 200> : any,
  ): ExpressResponse;
};

type ResponseBodyForStatus<
  S extends RouteSchema,
  Code extends keyof S["response"],
> = S["response"][Code] extends TSchema ? Static<S["response"][Code]> : any;
```

### Fastify Type Safety

For Fastify, combine with TypeBox type provider for full type inference:

```typescript
import type { FastifyRequest, FastifyReply } from "fastify";
import type { TypeBoxTypeProvider } from "@fastify/type-provider-typebox";
import type { Static, TSchema } from "@sinclair/typebox";
import type { RouteSchema } from "awilixify";

export type Request<S extends RouteSchema> = FastifyRequest<{
  Querystring: S["querystring"] extends TSchema
    ? Static<S["querystring"]>
    : unknown;
  Params: S["params"] extends TSchema ? Static<S["params"]> : unknown;
  Body: S["body"] extends TSchema ? Static<S["body"]> : unknown;
}>;

export type Reply<S extends RouteSchema> = FastifyReply<
  RouteGenericInterface,
  RawServerDefault,
  RawRequestDefaultExpression,
  RawReplyDefaultExpression,
  ContextConfigDefault,
  S,
  TypeBoxTypeProvider
>;
```

### Usage in Controllers

Once defined, use these types in your controllers for full type safety:

```typescript
import { GET, schema } from "awilixify";
import { Type } from "@sinclair/typebox";
import type { Request, Response } from "./types";

const GetUserSchema = {
  params: Type.Object({
    id: Type.String(),
  }),
  querystring: Type.Object({
    includeOrders: Type.Optional(Type.Boolean()),
  }),
  response: {
    200: Type.Object({
      id: Type.String(),
      name: Type.String(),
      email: Type.String(),
    }),
  },
};

export class UserController {
  @GET("/users/:id")
  @schema(GetUserSchema)
  async getUser(
    req: Request<typeof GetUserSchema>,
    res: Response<typeof GetUserSchema>,
  ) {
    // TypeScript knows req.params.id is a string
    // TypeScript knows req.query.includeOrders is boolean | undefined
    const user = await this.userService.getUser(req.params.id);

    // TypeScript enforces the response shape matches the schema along with status
    res.status(200).json({
      id: user.id,
      name: user.name,
      email: user.email,
    });
  }
}
```
