# Configurable Modules

Configurable modules accept runtime configuration via a wrapper function.
Each call returns a separate static module instance.

```typescript
import { createModule, type ModuleDef } from "awilixify";

type DatabaseModuleDef = ModuleDef<{
  providers: {
    connectionString: string;
    databaseService: DatabaseService;
  };
  exportKeys: ["databaseService"];
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

When the same configurable module is used multiple times, controllers are registered by default.
If a secondary instance should provide services only, set `registerControllers: false` in `createModule` options.

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
