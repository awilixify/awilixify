# Configurable Modules

Configurable modules accept runtime configuration via a wrapper function.
Each call returns a separate static module instance.

That means the returned module is different for every importer.
In practice, this is similar to a `forFeature(...)` style API:
every import gets a fresh module instance with its own providers and configuration.

```typescript
import { createModule, type ModuleDef } from "awilixify";

type DatabaseModuleDef = ModuleDef<{
  providers: {
    connectionString: string;
    databaseService: DatabaseService;
  };
  exports: ["databaseService"];
}>;

export function DatabaseModule(config: { connectionString: string }) {
  return createModule<DatabaseModuleDef>(
    {
      name: "DatabaseModule",
      providers: {
        connectionString: config.connectionString,
        databaseService: DatabaseService,
      },
      exports: ["databaseService"],
    },
    {
      hashNameFrom: config,
    },
  );
}

export const UserModule = createModule<UserModuleDef>({
  name: "UserModule",
  imports: [
    DatabaseModule({
      connectionString: "postgresql://localhost:5432/myapp",
    }),
  ],
});
```

Because each wrapper call creates a new module instance, controller registration also happens per instance by default.
That is why `registerControllers` exists.

If you import the same dynamic module shape multiple times but only want one instance to register controllers, use `registerControllers: false` on the others.
Otherwise, if the same controller class is registered more than once, awilixify throws a duplication error.

```typescript
export function AuthModule(config: { jwtSecret: string; audience: string }) {
  return createModule<AuthModuleDef>(
    {
      name: "AuthModule",
      controllers: [AuthController],
      providers: {
        jwtSecret: config.jwtSecret,
        audience: config.audience,
      },
    },
    {
      hashNameFrom: config,
      registerControllers: config.audience === "users",
    },
  );
}

export const AppModule = createModule<AppModuleDef>({
  name: "AppModule",
  imports: [
    AuthModule({ jwtSecret: "user-secret", audience: "users" }),
    AuthModule({ jwtSecret: "admin-secret", audience: "admins" }),
  ],
});
```

## Inject configuration with DIContext

`configureModule` runs a synchronous module factory during `DIContext.create()`,
injecting providers exported by its configuration imports:

```typescript
const MessagingDocsModule = configureModule({
  imports: [ConfigModule],
  inject: ["configService"],
  useFactory: (config) => RabbitMqAsyncApiDocsModule({
    title: "Orders Messaging API",
    version: config.get("imageVersion"),
    server: {
      host: `${config.get("rabbitMqHost")}:${config.get("rabbitMqPort")}`,
    },
  }),
});

const context = DIContext.create({ name: "App", imports: [MessagingDocsModule] });
await context.init();
```

Import `configureModule` from `awilixify`. Injection arguments are inferred from
exported provider keys. Typed modules returned by the factory retain their
export types for consumers. Factories must return a module synchronously.

Configuration dependencies are resolved before the factory runs. Their
constructors have run, but lifecycle hooks have not. Put synchronous environment
loading and validation in the configuration provider's constructor. A provider
may still use `onInit` for separate startup work; the factory cannot rely on its
results. Keep `eager: true` if the provider should also be resolved during
`init()` when nothing requests it earlier.

Scopes are available immediately after `create()`. Returned modules use normal
registration, validation, overrides, and lifecycle handling, including eager
providers. Each descriptor runs once per context, even when shared by importers.
Configuration cycles are rejected.

Configured modules must be imports or global modules, not the root module.
Keep the root as a plain module that aggregates configured imports.

This helper is supported by `DIContext` only; `AsyncDIContext` is unchanged.
