# Native Decorators

Use native ES decorators (Stage 3) to define routes directly in controller methods without `reflect-metadata` or `experimentalDecorators`.
Native decorators are standardized JavaScript syntax, which means better long-term compatibility, clearer runtime behavior, and no reliance on legacy TypeScript-only decorator semantics.
HTTP decorators live under `awilixify/http`.

Full example:
[HTTP integration on GitHub](https://github.com/awilixify/awilixify/tree/main/examples/fastify-cqrs/src/integrations/http)

## Fastify Example

The simplest mental model is to treat HTTP decorators as route metadata:

```typescript
import { GET, before, schema } from "awilixify/http";

const GetCatsSchema = {
  params: {
    type: "object",
    properties: {
      id: { type: "string" },
    },
    required: ["id"],
  },
  response: {
    200: {
      type: "object",
      properties: {
        id: { type: "string" },
        name: { type: "string" },
      },
    },
  },
};

const authMiddleware = async () => {};

export class CatsController {
  @GET("/cats/:id")
  @before(authMiddleware)
  @schema(GetCatsSchema)
  async getCat(req: { params: { id: string } }) {
    return {
      id: req.params.id,
      name: "Milo",
    };
  }
}
```

The built-in HTTP decorators exported from `awilixify/http` are:
`@controller`, `@GET`, `@POST`, `@PUT`, `@PATCH`, `@DELETE`, `@before`, `@after`, and `@schema`.

This approach becomes especially powerful when combined with [Initializers](/guide/initializers) and [Interceptors](/guide/interceptors).
