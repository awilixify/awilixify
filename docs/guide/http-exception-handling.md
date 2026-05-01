# HTTP Exception Handling

Awilix-modular includes built-in HTTP exception utilities and encourages separation between application errors and HTTP responses.

> [!TIP]
> Prefer `Result` for application logic and map to HTTP at controller boundaries. See [Result recipe](/docs/recipes-result).

### Built-in HTTP Exceptions

The library includes type-safe `HttpException` classes and factory helpers for standard HTTP errors:

```typescript
import { httpException, HttpException, HttpStatus } from "awilix-modular";

// Using factory helpers with default messages
throw httpException.notFound(); // "Not Found" with 404 status
throw httpException.unauthorized(); // "Unauthorized" with 401 status
throw httpException.badRequest(); // "Bad Request" with 400 status

// With custom messages
throw httpException.notFound("User not found");
throw httpException.forbidden("Insufficient permissions");
```

**Available exception helpers:**

- `badRequest(message?, response?)` - 400
- `unauthorized(message?, response?)` - 401
- `forbidden(message?, response?)` - 403
- `notFound(message?, response?)` - 404
- `conflict(message?, response?)` - 409
- `unprocessableEntity(message?, response?)` - 422
- `internalServerError(message?, response?)` - 500

### Handling HTTP Exceptions in Controllers

Use try/catch blocks to handle thrown exceptions:

```typescript
import { GET } from "awilix-modular";
import { httpException } from "awilix-modular";
import type { Request, Response } from "./types";

export class UserController {
  constructor(private readonly userService: UserModuleDeps["userService"]) {}

  @GET("/users/:id")
  async getUser(req: Request, res: Response) {
    try {
      const user = await this.userService.getUser(req.params.id);
      return res.json(user);
    } catch (error) {
      if (error instanceof HttpException) {
        return res.status(error.getStatus()).json(error.getResponse());
      }

      // Handle unexpected errors
      return res.status(500).json({ message: "Internal server error" });
    }
  }
}

// In your service
class UserService {
  async getUser(id: string): Promise<User> {
    const user = await this.deps.database.findUser(id);

    if (!user) {
      throw httpException.notFound(`User with id ${id} not found`);
    }

    return user;
  }
}
```

### Error-as-Value Pattern (Recommended for Application Logic)

While HTTP exceptions work for simple cases, awilix-modular **encourages the error-as-value pattern in application logic** for better separation of concerns and type safety.

#### Why Not Throw HTTP Errors in Application Logic?

**Application and Infrastructure Separation**: Throwing HTTP exceptions couples your business logic to HTTP infrastructure. This creates problems when:

- **Cron jobs** need to execute the same logic but have no HTTP context
- **Message queues** process the same operations outside of HTTP requests
- **Testing** requires mocking HTTP-specific error handling
- **Reusability** - business logic should work in any context (HTTP, CLI, background jobs, etc.)

```typescript
// ❌ BAD: Business logic coupled to HTTP
class UserService {
  async createUser(data: CreateUserDto) {
    if (!data.email) {
      throw httpException.badRequest("Email is required"); // HTTP error in business logic!
    }
    // This service can't be used in cron jobs or queues without HTTP semantics
  }
}

// ✅ GOOD: Business logic returns domain errors
class UserService {
  async createUser(
    data: CreateUserDto,
  ): Promise<Result<User, ValidationError>> {
    if (!data.email) {
      return Result.error(new ValidationError("Email is required"));
    }
    // This service works everywhere - HTTP, cron, queue, CLI
  }
}
```

**Additional Benefits of Error-as-Value**:

- **Explicit error handling** - Errors are declared in the function signature
- **Type safety** - TypeScript tracks which errors a function can return
- **Better composition** - Errors can be mapped, chained, and transformed without try/catch blocks

The error-as-value pattern makes errors explicit and type-safe:

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

#### Handling Error-as-Value in Controllers

Controllers translate application errors (Result types) into HTTP responses using `httpException`:

```typescript
import { GET, PUT, schema, httpException } from "awilix-modular";
import type { Request, Response } from "./types";

export class UserController {
  constructor(private readonly userService: UserModuleDeps["userService"]) {}

  @GET("/users/:id")
  async getUser(req: Request, res: Response) {
    const result = await this.userService.getUser(req.params.id);

    if (result.ok) {
      return res.json(result.val);
    }

    // Map application errors to HTTP errors at the boundary
    const error = result.error;

    if (error instanceof UserNotFoundError) {
      const httpError = httpException.notFound(error.message);
      return res.status(httpError.statusCode).json(httpError.getResponse());
    }

    if (error instanceof ValidationError) {
      const httpError = httpException.badRequest("Validation failed", {
        errors: error.details,
      });
      return res.status(httpError.statusCode).json(httpError.getResponse());
    }
  }
}
```
