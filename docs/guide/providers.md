# Providers

**Providers are the main building blocks of modules.** They register injectable services, repositories, helpers, factories, and primitive configuration. Each module declares providers that can be used internally or exported to other modules.

There are four types of providers:

- **Class providers** - Pass a class constructor (most common)
- **Factory providers** - Custom initialization logic with explicit dependencies
- **Primitive providers** - Values like strings, numbers, booleans
- **Class providers with options** - Class with Awilix configuration (lifetime, injector, etc.)

### Class Providers

The simplest and most common way to register providers - just pass the class constructor:

```typescript
type UserModuleDef = ModuleDef<{
  providers: {
    userService: UserService;
    emailService: EmailService;
  };
}>;

export const UserModule = createStaticModule<UserModuleDef>({
  name: "UserModule",
  providers: {
    userService: UserService,
    emailService: EmailService,
  },
});
```

### Factory Providers

Use factory providers when you need custom initialization logic or working with third-party libraries:

```typescript
// email.module.ts
type EmailModuleDef = ModuleDef<{
  providers: {
    apiKey: string;
    emailService: EmailService;
  };
}>;

export const EmailModule = createStaticModule<EmailModuleDef>({
  name: "EmailModule",
  providers: {
    apiKey: "sendgrid_key_123",
    emailService: {
      provide: EmailService,
      // Declare name of dependencies you want to access in useFactory
      inject: ["apiKey"],
      useFactory: (apiKey) => {
        return new EmailService({ apiKey });
      },
    },
  },
});
```

For better type safety, use `createFactoryProvider` which creates a typed helper that provides types for useFactory params:

```typescript
import { createFactoryProvider } from "awilix-modular";

type NotificationModuleDef = ModuleDef<{
  providers: {
    apiKey: string;
    emailService: EmailService;
  };
}>;

// Create typed factory for this module's dependencies
const factory = createFactoryProvider<NotificationModuleDef["deps"]>();

export const NotificationModule = createStaticModule<NotificationModuleDef>({
  name: "NotificationModule",
  providers: {
    apiKey: "sendgrid_api_key_123",

    emailService: factory({
      provide: EmailService,
      inject: ["apiKey"],
      // each injected dep is fully typed
      useFactory: (apiKey) => {
        return new EmailService({ apiKey });
      },
    }),
  },
});
```

### Primitive Providers

Register simple values like strings, numbers, or booleans directly:

```typescript
type ConfigModuleDef = ModuleDef<{
  providers: {
    apiUrl: string;
    port: number;
    isDevelopment: boolean;
  };
}>;

export const ConfigModule = createStaticModule<ConfigModuleDef>({
  name: "ConfigModule",
  providers: {
    apiUrl: "https://api.example.com",
    port: 3000,
    isDevelopment: process.env.NODE_ENV === "development",
  },
});
```

### Class Providers with DI Options

Customize Awilix behavior by providing options like `lifetime`:

```typescript
import { Lifetime } from "awilix";

type OrderModuleDef = ModuleDef<{
  providers: {
    orderService: OrderService;
  };
}>;

export const OrderModule = createStaticModule<OrderModuleDef>({
  name: "OrderModule",
  providers: {
    orderService: {
      useClass: OrderService,
      lifetime: Lifetime.TRANSIENT,
    },
  },
  controllers: [
    {
      useClass: OrderController,
      lifetime: Lifetime.SCOPED,
    },
  ],
});
```

### Configuring Provider Options

Provider options (like `lifetime`, `injector`, etc.) can be configured at three levels, with more specific levels overriding general ones:

1. **DiContext level** - Default options for all providers across all modules
2. **Module level** (`providerOptions`) - Default options for all providers/controllers/handlers in the module
3. **Provider level** - Options for a specific provider (highest priority)

```typescript
// 1. DiContext level - applies to everything
DIContext.create(AppModule, {
  providerOptions: { lifetime: Lifetime.SINGLETON }, // default for all
});

// 2. Module level - overrides DiContext defaults
export const OrderModule = createStaticModule<OrderModuleDef>({
  name: "OrderModule",
  providerOptions: { lifetime: Lifetime.SCOPED }, // overrides DiContext
  providers: {
    orderService: OrderService, // uses SCOPED from module
    cacheService: {
      useClass: CacheService,
      lifetime: Lifetime.SINGLETON, // overrides module (highest priority)
    },
  },
  controllers: [
    {
      useClass: OrderController,
      lifetime: Lifetime.SINGLETON, // overrides module
    },
  ],
});
```

> [!NOTE]
> **Default Lifetime:** All providers use `Lifetime.SINGLETON` by default, and it's recommended to keep it unless other behavior is needed.

> [!IMPORTANT]
> **Singleton Scope:** `SINGLETON` lifetime is scoped to the module, not application-wide. Each module gets its own singleton instance.

> [!WARNING]
> **Strict Mode:** Awilix strict mode is enabled by default, which prevents lifetime mismatches. A consumer (like a controller) cannot have a shorter lifetime than the providers it depends on. For example, a `SCOPED` controller cannot inject a `TRANSIENT` provider.

### Scoped Controllers

When using `SCOPED` lifetime for controllers with manual route registration, inject `resolveSelf` to get a fresh instance per request:

```typescript
export class UserController {
  private readonly instanceId = Math.random().toString(36).substring(7);

  constructor(
    private readonly userService: UserModuleDeps["userService"],
    private readonly resolveSelf: () => UserController, // Injected automatically
    private readonly app: UserModuleDeps["app"],
  ) {}

  registerRoutes() {
    app.get("/users/:id", async (req, res) => {
      // Resolve request-scoped instance
      const controller = this.resolveSelf();

      const user = await controller.userService.getUser(req.params.id);
      res.send({ user, instanceId: controller.instanceId });
    });
  }
}

// Configure scoped lifetime in module
export const UserModule = createStaticModule<UserModuleDef>({
  name: "UserModule",
  providers: { userService: UserService },
  controllers: [
    {
      useClass: UserController,
      lifetime: Lifetime.SCOPED, // Each request gets new instance
    },
  ],
});
```

> [!NOTE]
> For decorator-based controllers, `resolveSelf` is not needed—scoped resolution happens automatically per request.
