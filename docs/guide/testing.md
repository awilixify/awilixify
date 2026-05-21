# Testing

awilixify tests usually use the same module graph as the application and then disable or replace only the parts that should not run in a test.

## Provider Overrides

Use `providerOverrides` to replace providers declared by the root module passed to `DIContext.create`.

```typescript
const app = DIContext.create(OwnersModule, {
  providerOverrides: {
    ownersService: FakeOwnersService,
    owners1Service: {
      useClass: FakeOwners1Service,
      lifetime: "SINGLETON",
    },
  },
});
```

Overrides use the same provider syntax as `module.providers`:

```typescript
providerOverrides: {
  service: FakeService,
  repository: { useClass: InMemoryRepository },
  config: testConfig,
  db: {
    useFactory: () => createTestDb(),
  },
}
```

> [!IMPORTANT]
> A provider override is a complete provider definition replacement.
> Original provider options such as `lifetime`, `eager`, `initAfter`, and `allowCircular` are not preserved unless repeated in the override.

The first version of provider overrides is intentionally scoped to the root module's own providers. Imported providers are not overridden through this option.

```typescript
DIContext.create(OwnersModule, {
  providerOverrides: {
    // allowed only if ownersService is declared in OwnersModule.providers
    ownersService: FakeOwnersService,
  },
});
```

Override typing checks the public injectable contract of the original provider. Private and protected members are ignored so separately declared test doubles can be used without extending the original class.

## Module Overrides

Use `moduleOverrides` when you need to override providers or other keyed features in a specific module, including global modules, imported modules, and nested imported modules.

```typescript
const app = DIContext.create(AppModule, {
  globalModules: [ConfigModule],
  moduleOverrides: [
    overrideModule(ConfigModule, {
      providers: {
        config: testConfig,
      },
    }),
  ],
});
```

`overrideModule` matches modules by object identity. For dynamic modules, hoist the module instance if tests need to override it:

```typescript
export const CatsCacheModule = CacheModule("cats");

export const CatsModule = createModule<CatsModuleDef>({
  name: "CatsModule",
  imports: [CatsCacheModule],
});

const app = DIContext.create(AppModule, {
  moduleOverrides: [
    overrideModule(CatsCacheModule, {
      providers: {
        cache: testCache,
      },
    }),
  ],
});
```

You can override other keyed module features as well:

```typescript
DIContext.create(AppModule, {
  moduleOverrides: [
    overrideModule(CatsModule, {
      providers: {
        catsService: FakeCatsService,
      },
      queryPreHandlers: {
        auth: AllowAllAuthMiddleware,
      },
      interceptors: {
        cache: NoopCacheInterceptor,
      },
      initializers: {
        cron: NoopCronInitializer,
      },
    }),
  ],
});
```

Only features declared by the target module can be overridden. If the target module is not found in the bootstrapped module graph, awilixify throws during bootstrap.

## Skipping Bootstrap Work

awilixify has a few controls for disabling startup behavior while keeping the module graph available for tests.

### Initializers

Initializers are startup wiring for decorated controller methods. In focused unit or module tests, you may want to bootstrap the container without registering routes, queue listeners, cron jobs, or message handlers.

```typescript
const app = DIContext.create(OwnersModule, {
  globalModules: [ConfigModule],
});

await app.init({
  excludeInitializers: true,
});
```

You can also skip only selected initializer keys:

```typescript
await app.init({
  excludeInitializers: ["cron", "onQueueJob"],
});
```

### `postInit`

Use `excludePostInit` when eager provider `init()` should run, decorators should register routes/listeners, but the final startup side effect should not run.

This is useful for HTTP tests where the Fastify or Express app should be initialized but should not listen on a port.

```typescript
const app = DIContext.create(AppModule, {
  globalModules: [ConfigModule, HttpModule],
});

await app.init({
  excludePostInit: ["fastifyService"],
});
```

You can skip all `postInit()` hooks:

```typescript
await app.init({
  excludePostInit: true,
});
```

### Manual Route Registration

`skipRegisterRoutes` disables bootstrap-time `controller.registerRoutes()` calls.

```typescript
const app = DIContext.create(OwnersModule, {
  skipRegisterRoutes: true,
});
```

This does not disable controller registration. Decorator-based initializers can still use controller metadata during `app.init()` unless you also exclude initializers.
