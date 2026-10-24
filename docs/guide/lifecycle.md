# Lifecycle

Awilixify expose two lifecycle calls:

- `await app.init()`
- `await app.close()`

`init()` runs startup lifecycle work.  
`close()` runs application shutdown hooks, then tears down created Awilix scopes.

Full examples:

- [HTTP](https://github.com/awilixify/awilixify/tree/main/examples/fastify-cqrs/src/integrations/http)
- [Config](https://github.com/awilixify/awilixify/tree/main/examples/fastify-cqrs/src/integrations/config)

## Quick Example

```typescript
import { DIContext, createModule } from "awilixify";

class FastifyService {
  async onInit() {
    // register plugins, prepare connections, warm caches...
  }

  async afterInit() {
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

  app.enableShutdownHooks();
}

bootstrap();
```

## What Happens On `init()`

`app.init()` does not just resolve the root module.
It runs the explicit startup lifecycle for the application.

This design keeps DI context creation synchronous, which keeps the normal container setup path simpler and faster.
At the same time, startup still supports async work because eager provider `onInit()` hooks and initializer tasks can be async and are awaited inside `app.init()`.

The important parts are:

1. eager providers are resolved
2. eager provider `onInit()` hooks are called
3. initializers run
4. eager provider `afterInit()` hooks are called

`init()` only runs once.
Calling it again reuses the same promise instead of running startup twice.

## Initializers Run On `init()`

Initializers do not run when you declare a module.
They do not run when you create the DI context.
They run only when you call `await app.init()`.

## Eager Providers

Providers are lazy by default.
If you want a provider to participate in startup lifecycle, mark it as eager.

`onInit()` and `afterInit()` run only for eager providers during `app.init()`, not when a provider is resolved. All eager `onInit()` hooks finish before decorator initializers run; `afterInit()` hooks run afterward.

```typescript
import { createModule } from "awilixify";

class ConfigService {
  async onInit() {
    console.log("config onInit");
  }

  async afterInit() {
    console.log("config afterInit");
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

## `afterInit()`

If an eager provider implements `afterInit()`, it runs after eager provider initialization and after initializer tasks have completed.

This is useful when a provider needs other startup wiring to already exist before running its final startup step.

## What Happens On `close()`

`await app.close()` runs three phases:

1. Await all `beforeShutdown()` hooks to stop intake and finish active work.
2. Await all `onShutdown()` hooks to release connections and other resources.
3. Internally dispose created Awilix scopes in reverse creation order.

Hooks run concurrently within each phase, across all modules. Every hook in a phase settles before the next phase starts. `initAfter` only controls startup; it does not order shutdown hooks.

Shutdown hooks run on already-created singleton instances cached in application module containers, including non-eager providers resolved as dependencies or directly from the container. `eager: true` and `app.init()` are not required for shutdown participation. Unused providers are never instantiated just to shut them down. A shared instance receives each hook only once.

::: warning Singleton lifetime required
Application shutdown hooks are supported only on singleton providers. During `DIContext.create()` or `AsyncDIContext.create()`, Awilixify checks class prototype methods, including inherited methods, and rejects scoped or transient providers declaring these hooks with `ShutdownHookRequiresSingletonLifetimeError`. This uses effective registration lifetimes after module overrides are applied, happens before `app.init()`, and does not instantiate providers for validation.

Hooks assigned in constructors, declared as class fields, or returned by factories cannot be detected without creating an instance. These are not validated, and unsupported non-singleton hooks are skipped during shutdown. There is no shutdown-hook validation on the request resolution path. Request-scoped and transient resource cleanup belongs to the caller or request scope, not application shutdown.
:::

Instances owned by manually created child scopes are not tracked by the application shutdown lifecycle. Their owners must manage cleanup explicitly.

```typescript
import type { BeforeShutdown, OnShutdown } from "awilixify";

class HttpService implements BeforeShutdown {
  async beforeShutdown() {
    await this.fastify.close();
  }
}

class SchedulerService implements BeforeShutdown {
  async beforeShutdown() {
    this.scheduler.stop();
    await Promise.allSettled([...this.runningJobs]);
  }
}

class DatabaseService implements OnShutdown {
  async onShutdown() {
    await this.pool.end();
  }
}
```

The fields in this sketch represent your injected resources and tracked job promises. Use `eager: true` for services that must start during `app.init()`, not merely to receive shutdown hooks. Job handlers must return or await all their work so draining can track it.

Keep shared resources available during `beforeShutdown()`. Close them in `onShutdown()`, after HTTP requests and background jobs have finished. Hooks within the same phase must not rely on one another's execution order.

`onShutdown()` is the final application lifecycle hook. Existing Awilix provider disposers remain supported and run afterward, but do not register the same cleanup in both places.

`close()` runs once; repeated calls return the same promise. If startup is still running, disposal waits for it to settle. Providers resolved before a startup failure also receive shutdown hooks, so their cleanup must tolerate partial initialization.

If a hook or scope disposer fails, remaining hooks and cleanup are still attempted. `close()` rejects with an `AggregateError` containing the failures after cleanup finishes. A rejected drain hook does not prevent resource cleanup, so hooks must await their active work even when individual tasks fail.

## Process signals

Call `app.enableShutdownHooks()` to opt into framework-managed `SIGINT` and `SIGTERM` handling. No listeners are installed by default. Repeated calls do not add duplicate listeners, and enabling hooks after closing has no effect.

On the first signal, Awilixify awaits `app.close()`. Further signals are ignored while shutdown is running. After successful cleanup, it re-sends the original signal so Node terminates normally. If shutdown fails, it logs the error and exits with code 1.

`app.close()` removes the framework's signal listeners on success or failure. Calling it manually does not terminate the process. It can therefore be used in tests, embedded applications, or your own signal handler:

```typescript
process.once("SIGTERM", async () => {
  await app.close();
});
```

Choose framework-managed signals or your own signal handlers, not both. With manual handling, you own error handling and process termination. Kubernetes can still force-kill the process when its termination grace period expires.
