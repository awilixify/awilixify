# ExecutionContext

`executionContext` is immutable runtime input passed to mediator execution.

### Why it exists

- to carry transport/runtime data (for example auth token, tenant header, request metadata) into the mediator pipeline without coupling handlers to HTTP framework request objects
- lets pre-handlers act as a guard/validation layer before handler execution, moving request-driven checks out of HTTP framework middleware

### Where to use it

Use `executionContext` only in pre-handlers.
Handlers should work with `context` produced by pre-handlers.

```typescript
import type { ExecutionContext } from "awilixify";

declare module "awilixify" {
  interface ExecutionContext {
    token?: string;
    tenantName: string;
  }
}

await queryMediator.execute(
  "users/get",
  { userId: "u-1" },
  { executionContext: { token: "jwt", tenantName: "asus" } },
);
```

### Example in pre-handlers

```typescript
import type { Middleware, MiddlewareContract } from "awilixify";

class AuthMiddleware implements Middleware {
  static readonly key = "auth";
  declare readonly contract: MiddlewareContract<
    typeof AuthMiddleware.key,
    { userId: string }
  >;

  async execute(
    _payload,
    _context,
    executionContext: this["contract"]["executionContext"],
  ) {
    if (!executionContext.token) {
      throw new Error("Unauthorized");
    }

    return { userId: "u-1" };
  }
}
```
