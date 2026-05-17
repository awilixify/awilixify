# Async Modules And Async Factories

Awilixify supports async module bootstrap, but there is an important distinction:

- `DIContext` is the normal synchronous bootstrap path
- `AsyncDIContext` is the async bootstrap path

Use `AsyncDIContext` when your module graph or provider registration needs async work during bootstrap.

## Why `AsyncDIContext` Exists

Awilix containers are fundamentally lazy and sync-oriented during normal registration and resolution.
That is good for performance and keeps the common bootstrap path simple.

Because of that, async provider factories cannot be treated the same way as normal sync providers during regular `DIContext.create(...)` bootstrap.

So the rule is:

- for async factory providers, use `AsyncDIContext`
- for async module imports, use `AsyncDIContext`

## Async Factory Providers

If a provider uses `async useFactory`, bootstrap it with `AsyncDIContext`.

```typescript
import { AsyncDIContext, createModule } from "awilixify";

const AppModule = createModule({
  name: "AppModule",
  providers: {
    db: {
      inject: [],
      useFactory: async () => {
        return await connectToDb();
      },
    },
  },
});

const app = await AsyncDIContext.create(AppModule);
```

If you try to use a normal async factory provider with sync `DIContext.create(...)`, awilixify throws.

## Async Module Imports

If a module import itself is async, use `AsyncDIContext`.

```typescript
import { AsyncDIContext, createModule } from "awilixify";

async function createImportedModule() {
  return createModule({
    name: "ImportedModule",
    providers: {
      value: 123,
    },
  });
}

const AppModule = createModule({
  name: "AppModule",
  imports: [createImportedModule()],
});

const app = await AsyncDIContext.create(AppModule);
```

## Special Case: Async Eager Factories With `DIContext`

There is one important exception.

If an async factory provider is marked as eager, it can still be used with sync `DIContext`.
In that case, the provider is resolved during `await app.init()`.

```typescript
import { DIContext, createModule } from "awilixify";

const AppModule = createModule({
  name: "AppModule",
  providers: {
    db: {
      eager: true,
      inject: [],
      useFactory: async () => {
        return await connectToDb();
      },
    },
  },
});

const app = DIContext.create(AppModule);

await app.init();

const db = app.scope.resolve("db");
```

Before `app.init()`, resolving that provider throws.
After `app.init()`, the provider is available.

This is useful when you want to keep DI context creation synchronous and fast, but still need async startup logic for a small number of eager singleton resources.

## Why This Works

This pattern works because async startup is shifted into lifecycle initialization.

- `DIContext.create(...)` stays synchronous
- the async eager factory is awaited later during `app.init()`

That keeps the default container bootstrap path fast while still supporting async startup logic where needed.

## Singleton Restriction

Async factory providers must use singleton lifetime.

The core reason is that unresolved async members cannot be registered into the Awilix container as normal lazy runtime members.
Awilix registration and normal resolution are sync-oriented, so awilixify has to await async factories before putting the final value into the container.

Because of that, async factories are materialized once during `AsyncDIContext` bootstrap, or once during eager lifecycle initialization, and then registered as resolved values.
That fits singleton lifetime, but not normal repeated non-singleton lazy resolution.

```typescript
const AppModule = createModule({
  name: "AppModule",
  providers: {
    db: {
      lifetime: "SINGLETON",
      inject: [],
      useFactory: async () => connectToDb(),
    },
  },
});
```

If an async factory uses a non-singleton lifetime, awilixify throws.

## Rule Of Thumb

Use `AsyncDIContext` when:

- you have async factory providers
- you have async module imports

Use sync `DIContext` when:

- your providers are normal sync providers
- you want the fastest normal bootstrap path
- your async factory is an eager singleton that can wait until `app.init()`
