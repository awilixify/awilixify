# Mediator

Mediator is the typed execution gateway for handlers inside a module.
It uses handler contracts to provide type-safe `execute(...)` calls.

### What Mediator does

- resolves handlers registered in the current module
- enforces contract key/payload/response types at compile time
- applies pre-handlers and scenarios during execution

### Injecting Mediator

```typescript
class UserController {
  constructor(private readonly queryMediator: Deps["queryMediator"]) {}
}
```

### Executing a query

```typescript
const user = await this.queryMediator.execute("users/get-user", {
  userId: req.params.id,
});
```

If handler contract changes, `execute(...)` typing updates automatically.

### Scenarios and middleware

Mediator accepts execution options for scenarios with
selecting proper return type by used scenario:

```typescript
const result = await this.queryMediator.execute(
  "users/get",
  { userId: "u-1" },
  {
    executionContext: req.context,
    scenario: "auth-only",
    includePreHandlerKeys: ["auth"],
  },
);
```

This keeps controller code simple while preserving strict types for payload and return type of handlers.
