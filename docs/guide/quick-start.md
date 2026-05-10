# Quick Start

This guide demonstrates building a modular application with `OrderModule` and `UserModule`, showing how modules import each other and share dependencies with full type safety.

### 1. Create OrderModule with its definitions

Define `OrderModule` with typed providers and export `orderService` for other modules:

```typescript
// order.module.ts
import { createStaticModule, type ModuleDef } from "awilixify";

import { OrderService } from "./order.service";

// Define OrderModule
type OrderModuleDef = ModuleDef<{
  providers: {
    orderService: OrderService;
  };
  exportKeys: ["orderService"];
}>;

export const OrderModule = createStaticModule<OrderModuleDef>({
  name: "OrderModule",
  providers: {
    orderService: OrderService,
  },
  exports: {
    orderService: OrderService,
  },
});
```

### 2. Create UserModule with its definitions

Define `UserModule` and import `OrderModule`:

```typescript
// user.module.ts
import { createStaticModule, type ModuleDef } from "awilixify";

import { OrderModule } from "../order/order.module";
import { UserService } from "./user.service";
import { EmailService } from "./email.service";

// Define UserModule that imports OrderModule
type UserModuleDef = ModuleDef<{
  providers: {
    userService: UserService;
    emailService: EmailService;
  };
  imports: [typeof OrderModule];
}>;
// Available deps within module
export type UserModuleDeps = UserModuleDef["deps"];

export const UserModule = createStaticModule<UserModuleDef>({
  name: "UserModule",
  imports: [OrderModule],
  providers: {
    userService: UserService,
    emailService: EmailService,
  },
});
```

### 3. Create GlobalModule to share dependencies

Create a global module for app-wide dependencies like http framework
instance, logger...
Use `declare module` to make global dependencies available to all modules:

```typescript
// global.module.ts
import {
  createStaticModule,
  type ModuleDef,
  type InferGlobalDependencies,
} from "awilixify";
import type { Express } from "express";

export type GlobalModuleDef = ModuleDef<{
  providers: {
    app: Express;
  };
  exportKeys: ["app"];
}>;

export function GlobalModule(app: Express) {
  return createStaticModule<GlobalModuleDef>({
    name: "GlobalModule",
    providers: {
      app,
    },
    exports: ["app"],
  });
}

// Extend GlobalDependencies to make global module exports available everywhere
declare module "awilixify" {
  interface GlobalDependencies extends InferGlobalDependencies<GlobalModuleDef> {}
}
```

### 4. Instantiate DIContext with AppModule

Instantiate DIContext with root module and global modules:

```typescript
// app.module.ts
import { DIContext } from "awilixify";

import { UserModule } from "./user.module";
import { GlobalModule } from "./global.module";

type AppModuleDef = ModuleDef<{
  imports: [typeof UserModule];
}>;

export const AppModule = createStaticModule<AppModuleDef>({
  name: "AppModule",
  imports: [UserModule],
});

// initialize your http framework instance
const app = express();

// Instantiate DIContext with root module and global modules
DIContext.create(AppModule, {
  framework: app,
  globalModules: [GlobalModule(app)],
});

// run your http framework service as usual
app.listen(3000);
```

### 5. Type-safe dependency injection from module definition

Use `ModuleDef['deps']` as **single source of truth** to get automatic type inference for all available dependencies in your service constructors.  
This includes:
- module providers
- imported module exports
- exported providers from global modules
- module mediator instance (if query/command handlers are registered)

```typescript twoslash
// @noErrors
// @noStaticSemanticInfo: true
// @filename: user.module.ts
export type UserModuleDeps = {
  emailService: { send: (to: string, body: string) => Promise<void> };
  orderService: { findAll: () => string[] };
};
// ---cut---
// user.service.ts
import { UserModuleDeps } from "./user.module";

class UserService {
  constructor(
    // From UserModule providers
    private readonly emailService: UserModuleDeps["emailService"],
    // From OrderModule providers
    private readonly orderService: UserModuleDeps["orderService"],
    // From global module exports
    private readonly app: UserModuleDeps["app"],
  ) {}

  async notifyWithOrders(to: string) {
    this.emailService.s
    //                 ^|

    this.orderService.f
    //                 ^|
  }
}
```

### 6. Use controllers with any framework

Route definition happens within `registerRoutes` controller method(or with
native ES Stage 3 decorators).
It allows integration with **any HTTP framework** you pass through global dependencies (Express, Fastify, Hono, Koa, etc.).  
This is especially useful for gradually migrating existing applications to a modular architecture without a full rewrite

```typescript
// user.controller.ts
import type { Express, Request, Response } from "express";
import { Controller } from "awilixify";

import { UserModuleDeps } from "./user.module.ts";

class UserController implements Controller {
  constructor(
    private readonly userService: UserModuleDeps["userService"],
    // taken from global module exports
    private readonly app: UserModuleDeps["app"],
  ) {}
  registerRoutes() {
    // Direct framework API - no abstraction layer
    app.get("/users/:id", async (req: Request, res: Response) => {
      const user = await this.userService.getUser(req.params.id);
      res.json(user);
    });
  }
}

// user.module.ts - Add controller to module
export const UserModule = createStaticModule<UserModuleDef>({
  name: "UserModule",
  imports: [OrderModule],
  providers: {
    userService: UserService,
    emailService: EmailService,
  },
  controllers: [UserController], // Register controller
});
```
