# Contracts

Contract declarations keep typings for handlers in one place.  
Both `QueryContract` and `CommandContract` are supported.

### Strict Contract in One Place

Each handler defines its contract within itself:

```typescript
import type { QueryContract, CommandContract } from "awilixify";

export class GetUserQueryHandler {
  static readonly key = "users/get-user";
  declare readonly contract: QueryContract<
    typeof GetUserQueryHandler.key,
    { userId: string },
    User
  >;
}

export class CreateUserCommandHandler {
  static readonly key = "users/create-user";
  declare readonly contract: CommandContract<
    typeof CreateUserCommandHandler.key,
    { email: string; name: string },
    { id: string }
  >;
}
```

### Why contracts matter

Contracts are the single source of truth for typing a use-case:

- key (use-case identifier)
- payload shape
- return/response shape
- context shape(`this['contract']['context']`) inferred from pre-handlers
- scenario-based context/return variations

Mediator uses module-registered contracts to know which handlers are available in that module and to type `execute(...)` calls correctly.
