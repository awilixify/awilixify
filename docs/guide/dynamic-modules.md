# Dynamic Modules

Dynamic modules accept runtime configuration using the `forRoot` pattern, so the same module can be configured differently per import.

```typescript
import { createDynamicModule, type ModuleDef } from "awilix-modular";

type DatabaseModuleDef = ModuleDef<{
  providers: {
    connectionString: string;
    databaseService: DatabaseService;
  };
  exportKeys: ["databaseService"];
  // adding forRootConfig makes module dynamic
  forRootConfig: { connectionString: string };
}>;

export const DatabaseModule = createDynamicModule<DatabaseModuleDef>((config) =>
  createStaticModule({
    name: "DatabaseModule",
    providers: {
      connectionString: config.connectionString,
      databaseService: DatabaseService,
    },
    exports: {
      databaseService: DatabaseService,
    },
  }),
);

export const UserModule = createStaticModule<UserModuleDef>({
  name: "UserModule",
  imports: [
    DatabaseModule.forRoot({
      connectionString: "postgresql://localhost:5432/myapp",
    }),
  ],
});
```

When the same dynamic module is used multiple times, `registerControllers` controls which instance registers routes:

```typescript
export const AppModule = createStaticModule<AppModuleDef>({
  name: "AppModule",
  imports: [
    // primary instance: registers controllers and routes
    AuthModule.forRoot(
      { jwtSecret: "user-secret", audience: "users" },
      { registerControllers: true },
    ),
    // secondary instance: services only (default)
    AuthModule.forRoot({ jwtSecret: "admin-secret", audience: "admins" }),
  ],
});
```
