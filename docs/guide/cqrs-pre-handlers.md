# Pre-Handlers

Pre-handlers run before query/command handlers and are declared with global modules or at module level via `queryPreHandlers` / `commandPreHandlers`.
This lets you move business checks out of framework-coupled guards (which depend on request objects) into mediator pre-handlers, while keeping the same module-based DI and merging pre-handler error types into the handler return type (see [Error and Context Merging](/docs/cqrs-error-merging-result)).

### Define Pre-Handlers

Pre-handlers can depend on other pre-handlers via `requires`.  
Execution order is restricted: a middleware must run only after all dependencies in `requires` are already processed.
If the order is invalid, mediator throws `MiddlewareRequiredError`.

Context for pre-handler is calculated from required `MiddlewareContract`'s:

- `AuthMiddleware` adds `{ userId: string }`
- `TenantMiddleware` depends on `AuthMiddleware`, so its input `context` is inferred as `{ userId: string }`

```typescript
import {
  Result,
  type Middleware,
  type MiddlewareContract,
} from "awilix-modular";

class UnauthorizedError extends Error {}
class TenantNotFoundError extends Error {}

class AuthMiddleware implements Middleware {
  static key = "auth";
  declare readonly contract: MiddlewareContract<
    typeof AuthMiddleware.key,
    Result<{ userId: string }, UnauthorizedError>
  >;

  async execute(_payload, _context, executionContext) {
    if (!executionContext.token) return Result.error(new UnauthorizedError());

    return Result.ok({ userId: "u-1" });
  }
}

class TenantMiddleware implements Middleware {
  readonly requires = ["auth"] as const;

  static key = "tenant";
  declare readonly contract: MiddlewareContract<
    typeof TenantMiddleware.key,
    Result<{ tenantId: string }, TenantNotFoundError>,
    [AuthMiddleware["contract"]]
  >;

  async execute(_payload, context, executionContext) {
    // available from success return type of required pre-handler
    const userId = context.userId;

    if (!executionContext.tenantName)
      return Result.error(new TenantNotFoundError());

    return Result.ok({ tenantId: "t-1" });
  }
}
```

### Context in Pre-Handlers and Handlers

`context` is mutable handler input built from successful pre-handler outputs.

### Context flow

1. pre-handlers run in dependency order
2. each successful pre-handler contributes typed data
3. merged data becomes handler `context`

```typescript
import type { QueryContract } from "awilix-modular";

class AuthMiddleware {
  async execute() {
    return { userId: "u-1" };
  }
}

class TenantMiddleware {
  async execute() {
    return { tenantId: "t-1" };
  }
}

class GetUserHandler {
  static readonly key = "users/get";
  declare readonly contract: QueryContract<
    typeof GetUserHandler.key,
    { userId: string },
    { id: string; tenantId: string }
  >;

  async executor(
    payload: this["contract"]["payload"],
    // { userId: string; tenantId: string }
    context: this["contract"]["context"],
  ) {
    return { id: payload.userId, tenantId: context.tenantId };
  }
}
```

Here, the contract is the source of truth: handler `context` is extracted from `this["contract"]["context"]`.

> [!NOTE]
> This example assumes `AuthMiddleware` and `TenantMiddleware` are registered and augmented globally (via `globalModules` in `DIContext.create(...)`).
