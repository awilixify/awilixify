# Why CQRS?

CQRS isn't just an architectural pattern—it's a mindset that brings clarity to your application structure. With awilixify, CQRS costs almost nothing to implement but provides significant benefits:

**Clear Mental Separation from Controllers**: Controllers become thin routing layers that delegate to handlers, keeping HTTP concerns separate from business logic:

```typescript
// Controller stays clean - just routes to handlers, or some http work
app.get("/users/:id", async (req, res) => {
  const result = await queryMediator.execute(
    "users/get-user",
    {
      userId: req.params.id,
    },
    { executionContext: req.context },
  );
  res.json(result);
});
```

**Strict Contract in One Place**: Each handler defines its contract (key, payload, response) in a single location, making it easy to understand what data flows through your system:

```typescript
import type { QueryContract } from "awilixify";

export class GetUserQueryHandler {
  static readonly key = "users/get-user"; // Unique identifier
  declare readonly contract: QueryContract<
    typeof GetUserQueryHandler.key,
    { userId: string }, // Input shape
    User // Output shape
  >;
}
```

**Separation Between Reads and Writes**: Query handlers read data, command handlers modify it. This distinction makes code easier to reason about, test, and optimize:

**Additional Benefits**:

- **Testability**: Handlers are isolated units that can be tested without HTTP infrastructure
- **Reusability**: Same handler works in controllers, cron jobs, message queues, or CLI commands
- **Type Safety**: Full TypeScript support from payload to response, with autocomplete everywhere
- **Middleware Pipeline**: Cross-cutting concerns (auth, logging, validation) apply consistently to all handlers
- **Framework Agnostic**: Business logic isn't coupled to Express, Fastify, or any HTTP framework

**Zero Cost**: Adding CQRS with awilixify requires minimal setup—just define handlers and register them. No complex configuration, no boilerplate, just clean separation of concerns.
