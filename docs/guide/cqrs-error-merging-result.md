# Error and Context Merging

Handler `context` is calculated from active pre-handlers.

> [!NOTE]
> In this example, `AuthMiddleware` and `TenantMiddleware` are assumed to be registered globally via a global module (`globalModules` in `DIContext.create(...)`).

- With `AuthMiddleware` + `TenantMiddleware`, handler context includes both `userId` and `tenantId`.
- If middlewares return `Result`, their error types are merged into handler `returnType`.

```typescript
import { type Handler, type QueryContract, Result } from "awilixify";
import type { UsersModuleDef } from "./users.module";

class HandlerError extends Error {}
type Response = Result<{ id: string }, HandlerError>;

export class GetUserHandler implements Handler<GetUserHandler["contract"]> {
  static readonly key = "users/get";
  declare readonly contract: QueryContract<
    typeof GetUserHandler.key,
    { userId: string },
    Response
  >;

  async executor(
    payload: this["contract"]["payload"],
    // { userId: string; tenantId: string }
    context: this["contract"]["context"],
  ) {
    return Result.ok({ id: payload.userId });
  }
}
```

From the execute side, merged errors are also inferred!

```typescript
// result: Result<{ id: string }, HandlerError | UnauthorizedError | TenantNotFoundError>
const result = await this.queryMediator.execute("users/get", {
  userId: req.params.id,
});
```

> [!NOTE]
> If at least one active pre-handler returns `Result`, contract `returnType` is merged into `Result<Success, HandlerError | MiddlewareErrors>`.
> If no pre-handler returns `Result`, the plain handler response type is preserved.
