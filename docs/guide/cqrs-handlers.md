# Handlers

Handlers are executable units that process queries or commands.
A handler is the entry point for a business operation.

### Defining Handlers

Create handlers that implement the `Handler<QueryContract<...>>` interface with a unique static key and executor function:

```typescript
import { type Handler, type QueryContract } from "awilix-modular";
import type { UserModuleDeps } from "./user.module";

// Define payload and response types
type Payload = { userId: string };
type Response = { id: string; role: "admin" | "user" };

export class GetUserQueryHandler implements Handler<
  GetUserQueryHandler["contract"]
> {
  static readonly key = "users/get-user";
  declare readonly contract: QueryContract<
    typeof GetUserQueryHandler.key,
    Payload,
    Response
  >;

  constructor(private readonly userService: UserModuleDeps["userService"]) {}

  async executor(payload: Payload): Promise<Response> {
    return this.userService.findById(payload.userId);
  }
}
```

### Registering Handlers in Modules

Add query handlers to the module's `queryHandlers` array. Include them in the `ModuleDef` type for full mediator type safety:

```typescript
import { createStaticModule, type ModuleDef } from "awilix-modular";

type UserModuleDef = ModuleDef<{
  providers: {
    userService: UserService;
  };
  queryHandlers: [typeof GetUserQueryHandler];
}>;

export type Deps = UserModuleDef["deps"];

export const UserModule = createStaticModule<UserModuleDef>({
  name: "UserModule",
  providers: {
    userService: UserService,
  },
  queryHandlers: [GetUserQueryHandler],
});
```

### Handlers are regular DI-resolved classes

Handlers are resolved through the same DI container as providers and controllers.
That means DI options (like `lifetime`) are also valid for handlers:

```typescript
import { Lifetime } from "awilix";

export const UserModule = createStaticModule<UserModuleDef>({
  name: "UserModule",
  providers: {
    userService: UserService,
  },
  queryHandlers: [
    {
      useClass: GetUserQueryHandler,
      lifetime: Lifetime.SCOPED,
    },
  ],
});
```
