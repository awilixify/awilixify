# Interceptors

Interceptors let you add cross-cutting behavior (caching, logging, metrics, retries) around provider method calls without changing business method signatures.

## Why It Exists

- Keep service methods focused on business logic.
- Move infra concerns (cache, telemetry, guards) out of method params and call sites.
- Apply behavior centrally per module via DI registration.
- Keep trigger points explicit via decorators/metadata on methods.

## How It Works

1. Register interceptor classes in module `interceptors`.
2. Create own decorator using `createInterceptDecorator(...)` and assign some
   metadata.
3. At runtime, awilixify wraps only providers that have decorated methods.
4. On decorated method call, registered module interceptors run in chain.

## Basic Usage

```ts
import {
  createInterceptDecorator,
  createModule,
  type ModuleDef,
  type Interceptor,
} from "awilixify";

const Cachable = (tag: string, ttlMs = 5000) =>
  createInterceptDecorator("cachable")({ tag, ttlMs });

class CacheInterceptor implements Interceptor {
  private store = new Map<string, { expiresAt: number; value: unknown }>();

  intercept(context) {
    const cfg = context.meta.cachable as
      | { tag?: string; ttlMs?: number }
      | undefined;
    if (!cfg?.tag) return context.proceed();

    const key = `${cfg.tag}:${JSON.stringify(context.args)}`;
    const now = Date.now();
    const hit = this.store.get(key);
    if (hit && hit.expiresAt > now) return hit.value;

    const result = context.proceed();
    if (result instanceof Promise) {
      return result.then((value) => {
        this.store.set(key, { value, expiresAt: now + (cfg.ttlMs ?? 5000) });
        return value;
      });
    }

    this.store.set(key, {
      value: result,
      expiresAt: now + (cfg.ttlMs ?? 5000),
    });
    return result;
  }
}

class UsersService {
  @Cachable("users:list", 10_000)
  list() {
    return [{ id: 1, name: "John" }];
  }
}

type AppDef = ModuleDef<{
  providers: { usersService: UsersService };
  interceptors: { cache: CacheInterceptor };
}>;

export const AppModule = createModule<AppDef>({
  name: "AppModule",
  providers: { usersService: UsersService },
  interceptors: { cache: CacheInterceptor },
});
```

## Notes

- Interceptors are resolved from DI, so lifetime/scope rules apply.
- Undecorated methods are not intercepted.
- Async interceptors make wrapped methods Promise-based.
