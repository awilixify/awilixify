# Result vs throw

`Result` is the recommended error model for application logic in awilix-modular.

It keeps business logic transport-agnostic and type-safe, then maps domain errors to HTTP only at the boundary.

### Why not throw in business logic

Throwing is effectively a `goto`-style non-local jump: control flow exits the normal path and resumes somewhere else (`catch`), which makes execution flow implicit and harder to reason about.

In application services this becomes a problem because:

- it couples business logic to transport/runtime behavior
- it hides error paths from function signatures
- it reduces reuse across HTTP, queues, cron jobs, and CLI

### Throw (anti-pattern in app logic)

```typescript
// ❌ BAD: Business logic coupled to HTTP
class UserService {
  async createUser(data: CreateUserDto) {
    if (!data.email) {
      throw httpException.badRequest("Email is required");
    }
    // hard to reuse outside HTTP semantics
  }
}
```

### Result (recommended)

```typescript
import { Result } from "awilix-modular";
import type { UserModuleDeps } from "./user.module";

class UserService {
  constructor(private readonly deps: UserModuleDeps) {}

  async createUser(
    data: CreateUserDto,
  ): Promise<Result<User, ValidationError>> {
    if (!data.email) {
      return Result.error(new ValidationError("Email is required"));
    }

    return Result.ok(user);
  }
}
```

### Additional benefits of Result

- explicit error contracts in return types
- type-safe composition without hidden throw paths
- business code stays framework-agnostic

### Result in services

```typescript
import { Result } from "awilix-modular";
import type { UserModuleDeps } from "./user.module";

class UserService {
  constructor(private readonly deps: UserModuleDeps) {}

  async getUser(id: string): Promise<Result<User, UserNotFoundError>> {
    const user = await this.deps.database.findUser(id);

    if (!user) {
      return Result.error(new UserNotFoundError(id));
    }

    return Result.ok(user);
  }
}
```

### Mapping at controller boundary

```typescript
const result = await this.userService.getUser(req.params.id);

if (result.ok) {
  return res.json(result.val);
}

if (result.error instanceof UserNotFoundError) {
  const httpError = httpException.notFound(result.error.message);
  return res.status(httpError.statusCode).json(httpError.getResponse());
}
```

For CQRS middleware + handler error type merging, see [Error and Context Merging](/docs/cqrs-error-merging-result).
