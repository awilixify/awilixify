# Lifecycle

Awilixify expose two lifecycle calls:

- `await app.init()`
- `await app.dispose()`

`init()` runs startup lifecycle work.  
`dispose()` tears down created Awilix scopes.

Full examples:

- [HTTP](https://github.com/wildstyles/awilixify/tree/main/examples/fastify-cqrs/src/integrations/http)
- [Config](https://github.com/wildstyles/awilixify/tree/main/examples/fastify-cqrs/src/integrations/config)

## Quick Example

```typescript
import { DIContext, createModule } from "awilixify";

class FastifyService {
  async init() {
    // register plugins, prepare connections, warm caches...
  }

  async postInit() {
    // start listening only after startup wiring is complete
  }
}

const AppModule = createModule({
  name: "AppModule",
  providers: {
    http: {
      eager: true,
      useClass: FastifyService,
    },
  },
});

async function bootstrap() {
  const app = DIContext.create(AppModule);

  await app.init();

  process.once("SIGINT", async () => {
    await app.dispose();
  });

  process.once("SIGTERM", async () => {
    await app.dispose();
  });
}

bootstrap();
```

## What Happens On `init()`

`app.init()` does not just resolve the root module.
It runs the explicit startup lifecycle for the application.

This design keeps DI context creation synchronous, which keeps the normal container setup path simpler and faster.
At the same time, startup still supports async work because eager provider `init()` hooks and initializer tasks can be async and are awaited inside `app.init()`.

The important parts are:

1. eager providers are resolved
2. eager provider `init()` hooks are called
3. initializers run
4. eager provider `postInit()` hooks are called

`init()` only runs once.
Calling it again reuses the same promise instead of running startup twice.

## Initializers Run On `init()`

Initializers do not run when you declare a module.
They do not run when you create the DI context.
They run only when you call `await app.init()`.

## Eager Providers

Providers are lazy by default.
If you want a provider to participate in startup lifecycle, mark it as eager.

```typescript
import { createModule } from "awilixify";

class ConfigService {
  async init() {
    console.log("config init");
  }

  async postInit() {
    console.log("config postInit");
  }
}

const AppModule = createModule({
  name: "AppModule",
  providers: {
    config: {
      eager: true,
      useClass: ConfigService,
    },
  },
});
```

::: warning Important
Eager providers must use singleton lifetime.
:::

## Startup Order With `initAfter`

If one eager provider should initialize after another, use `initAfter`.

```typescript
import { createModule } from "awilixify";

const AppModule = createModule({
  name: "AppModule",
  providers: {
    env: {
      eager: true,
      useClass: EnvService,
    },
    config: {
      eager: true,
      initAfter: ["env"],
      useClass: ConfigService,
    },
    http: {
      eager: true,
      initAfter: ["config"],
      useClass: HttpService,
    },
  },
});
```

This makes startup order explicit.
`initAfter` is effectively global across the application lifecycle.
You can wait for any eager provider, including providers coming from the same module, imported modules, or global modules.

If an `initAfter` dependency is not eager, or if the dependencies are circular, `app.init()` throws.

## `postInit()`

If an eager provider implements `postInit()`, it runs after eager provider initialization and after initializer tasks have completed.

This is useful when a provider needs other startup wiring to already exist before running its final startup step.

## What Happens On `dispose()`

`await app.dispose()` disposes the created Awilix scopes in reverse creation order.

Use it when your application is shutting down.
That is the point where registered container resources can be cleaned up through Awilix disposal behavior.

For resource cleanup in module providers, prefer native Awilix disposal on the provider itself.

```typescript
const AppModule = createModule({
  name: "AppModule",
  providers: {
    dbPool: {
      useFactory: createDbPool,
      dispose: (instance) => instance.killPool(),
    },
  },
});
```
