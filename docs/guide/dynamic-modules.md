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
