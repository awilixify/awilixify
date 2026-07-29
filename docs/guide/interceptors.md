# Interceptors

Interceptors add behavior around provider/controller method calls.
They are for call-time concerns such as caching, retries, logging, metrics, tracing, or policy enforcement.

They are not for startup-time wiring.
That is what [Initializers](/guide/initializers) are for.

Full examples:

- [Cache](https://github.com/awilixify/awilixify/tree/main/examples/fastify-cqrs/src/integrations/cache)
- [Retry](https://github.com/awilixify/awilixify/tree/main/examples/fastify-cqrs/src/integrations/retry)
- [Timeout](https://github.com/awilixify/awilixify/tree/main/examples/fastify-cqrs/src/integrations/timeout)

## Mental Model

- a decorator writes metadata onto a provider method
- an interceptor reads that metadata when the method is called
- the interceptor can run logic before or after `context.proceed()`

Only decorated methods are intercepted.
Undecorated methods stay plain.

## Why They Exist

Interceptors keep business methods focused on business logic while moving cross-cutting execution concerns into another common place.

Typical examples:

- cache reads and cache eviction
- retries
- metrics and tracing
- timing and structured logging
- guards or policy checks around service methods

## Cache Example

The Fastify example uses a cache decorator plus an interceptor.

Decorator:

```typescript
import { createDecoratorStateUpdater } from "awilixify";

type CacheOperationConfig<TArgs extends unknown[] = unknown[]> = {
  key: (...args: TArgs) => string;
  tags?: string[];
  ttl?: number;
};

type CacheMethodState<TArgs extends unknown[] = unknown[]> = {
  cache?: CacheOperationConfig<TArgs>;
  evict?: Omit<CacheOperationConfig<TArgs>, "ttl">;
};

const updater = createDecoratorStateUpdater("cache", {
  method: (): CacheMethodState<any[]> => ({}),
});

export const CACHE_METADATA_TOKEN = updater.token;

export function Cachable<TArgs extends unknown[]>(
  options: CacheOperationConfig<TArgs>,
) {
  return (_target: any, context: ClassMethodDecoratorContext) => {
    updater.update(context, {
      method: (previous) => ({
        ...previous,
        cache: options,
      }),
    });
  };
}
```

Interceptor:

```typescript
import type { Interceptor, InterceptContext } from "awilixify";

import { CACHE_METADATA_TOKEN } from "./cache.decorator.js";
import { Deps } from "./cache.module.js";

type CacheToken = typeof CACHE_METADATA_TOKEN;

export class CacheInterceptor implements Interceptor<CacheToken> {
  public readonly token = CACHE_METADATA_TOKEN;

  constructor(
    private readonly bentoCache: Deps["bentoCache"],
    private readonly namespace: Deps["namespace"],
  ) {}

  // runs once on every call of decorated method
  async intercept(context: InterceptContext<CacheToken>) {
    const namespace = this.bentoCache.namespace(this.namespace);
    const args = context.args;
    const { cache, evict } = context.metadata;

    if (evict) {
      // run decorated method and invalidate after
      const result = await context.proceed();
      const key = evict.key(...args);

      await Promise.resolve(namespace.delete({ key }));

      if (evict.tags?.length) {
        await namespace.deleteByTag({ tags: evict.tags });
      }

      return result;
    }

    // can handle logic for few decorators. So if cache state exists
    // (method was @Cachable()) - we cache
    if (cache) {
      return namespace.getOrSet({
        key: cache.key(...args),
        tags: cache.tags,
        factory: async () => context.proceed(),
        ttl: cache.ttl,
      });
    }

    return context.proceed();
  }
}
```

Usage in a provider:

```typescript
class CatsService {
  @Cachable({
    key: (id: string) => `cat:${id}`,
    ttl: 30_000,
  })
  getById(id: string) {
    return { id, name: "Milo" };
  }
}
```

## Notes

- Interceptors are resolved from DI, so normal lifetime rules apply.
- Interceptors can be async.
- Multiple interceptors can compose into a chain.
- If no registered interceptor matches the method metadata, the call stays untouched.

## Initializers vs Interceptors

Use initializers when the job is startup-time wiring(only controllers).  
Use interceptors when the job is call-time wrapping(controllers/providers).

Choose an initializer for:

- HTTP route registration
- event subscriptions
- queue worker registration
- RabbitMQ consumer registration
- cron scheduling

Choose an interceptor for:

- caching
- retries
- logging around service calls
- metrics and tracing
- policy checks around provider execution

A good rule:
if you need to connect a controller decorated method to an external runtime, use an initializer.
If you need to wrap the execution of a provider method, use an interceptor.
