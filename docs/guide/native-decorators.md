# Native Decorators

Use native ES decorators (Stage 3) to define routes directly in controller methods without `reflect-metadata` or `experimentalDecorators`.
Native decorators are standardized JavaScript syntax, which means better long-term compatibility, clearer runtime behavior, and no reliance on legacy TypeScript-only decorator semantics.

```typescript
import { controller, GET, POST, before, after, schema } from "awilix-modular";
import type { Express } from "express";
import { UserModuleDeps } from "./user.module";
import { authMiddleware, logMiddleware } from "./middlewares";

@controller("/users") // adds a path prefix for each route
@before(authMiddleware) // applies to all routes
export class UserController {
  constructor(private readonly userService: UserModuleDeps["userService"]) {}

  @GET("/:id")
  @after(logMiddleware) // applies to this route only
  async getUser(req, res) {
    const user = await this.userService.getUser(req.params.id);

    res.json(user);
  }

  @POST()
  @schema({
    body: {
      type: "object",
      properties: {
        name: { type: "string" },
        email: { type: "string", format: "email" },
      },
      required: ["name", "email"],
    },
    response: {
      201: {
        type: "object",
        properties: {
          id: { type: "string" },
          name: { type: "string" },
          email: { type: "string" },
        },
      },
    },
  })
  async createUser(req, res) {
    const user = await this.userService.createUser(req.body);

    res.status(201).json(user);
  }
}
```

Available decorators: `@controller`, `@GET`, `@POST`, `@PUT`, `@PATCH`, `@DELETE`, `@HEAD`, `@OPTIONS`, `@before`, `@after`, `@schema`.

`@schema` defines JSON Schema validation and OpenAPI docs for a route. It works with the `beforeRouteRegistered` hook for automatic validation and spec generation.
