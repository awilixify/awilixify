# Initializers

If you are reading the docs for the first time, think about an initializer like this:

an initializer is startup code that discovers decorated **controller** methods and connects them to a real runtime system.

Examples:

- an HTTP initializer registers controller methods as Fastify routes
- a queue initializer registers methods as BullMQ workers
- a RabbitMQ initializer registers methods as consumers
- an event initializer subscribes methods to an event emitter
- a cron initializer schedules methods as jobs

So the job of an initializer is simple:
take a decorated method and wire it into some external runtime.

> [!NOTE]
> Initializers are `singleton` features and they run only for controllers.
> They execute during startup, so `await app.init()` must be called for them to run.

Full examples:

- [HTTP](https://github.com/awilixify/awilixify/tree/main/examples/fastify-cqrs/src/integrations/http)
- [Event Emitter](https://github.com/awilixify/awilixify/tree/main/examples/fastify-cqrs/src/integrations/event-emitter)
- [Queue](https://github.com/awilixify/awilixify/tree/main/examples/fastify-cqrs/src/integrations/queue)
- [RabbitMQ](https://github.com/awilixify/awilixify/tree/main/examples/fastify-cqrs/src/integrations/rabbitmq)
- [Scheduler](https://github.com/awilixify/awilixify/tree/main/examples/fastify-cqrs/src/integrations/scheduler)

## Decorators

Before talking about initializers, it helps to be precise about decorators.

In awilixify, the purpose of a decorator is only to add metadata.
It does not register routes, start workers, subscribe to events, or schedule jobs.
It only marks a method with information that some initializer may use later.

You can create your own decorator like this:

```typescript
import { createDecoratorStateUpdater } from "awilixify";

type OnEventMethodState = {
  event?: string;
};

const updater = createDecoratorStateUpdater("on-event", {
  // function which creates initial state for decorated method
  method: (): OnEventMethodState => ({}),
});

export const ON_EVENT_TOKEN = updater.token;

export function onEvent(event: string) {
  return (_target: any, context: ClassMethodDecoratorContext) => {
    updater.update(context, {
      method: (previous) => ({
        ...previous,
        event,
      }),
    });
  };
}
```

This decorator does not subscribe anything by itself.
It only stores `{ event }` metadata on the method.

That is the key mental model:

- decorators describe
- initializers wire

This is also why awilixify does not need a dedicated integration package for every technology it interacts with.

## How Decorators And Initializers Work Together

1. A decorator writes metadata onto a class or method.
2. An initializer declares which decorator token it understands.
3. During module startup, awilixify finds decorated controller methods.
4. The initializer receives the method metadata and wires native runtime behavior.

So the decorator says what something is, and the initializer decides how that becomes real behavior.

## HTTP Initializer Example

This is the HTTP initializer from the Fastify example:

```typescript
import {
  Initializer,
  type InitializerContext,
  type MetadataInitializerContext,
  resolveDecoratorState,
  isResultLike,
} from "awilixify";
import {
  rollUpHttpDecoratorState,
  HTTP_DECORATOR_STATE_TOKEN,
} from "awilixify/http";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { Deps } from "./http.module.js";

// that's awilixify internal token for http decorators.
// Created in same way like in example above with
// "createDecoratorStateUpdater"
type HttpToken = typeof HTTP_DECORATOR_STATE_TOKEN;

export class FastifyHttpInitializer extends Initializer<HttpToken> {
  public readonly token = HTTP_DECORATOR_STATE_TOKEN;

  constructor(private readonly app: Deps['app']) {
    super();
  }

  // runs for every decorated method
  initialize(context: InitializerContext<HttpToken>) {
    const methodState = rollUpHttpDecoratorState(
      context.decoratorState.root,
      // decorated data by token a method has
      context.metadata,
    );

    for (const verb of methodState.verbs) {
      for (const path of methodState.paths) {
        this.app.route({
          method: verb,
          url: path,
          handler: async (req: unknown, res: unknown) =>
            // invoke of actual decorated method
            context.invoke(req, res),
          preHandler: methodState.beforeMiddleware,
          schema: methodState.schema,
        });
      }
    }
  }
}
```

The important part is not Fastify itself.
The important part is that the initializer reads decorator metadata and then uses the native Fastify API, `app.route(...)`, to register the route exactly how you want.

That same pattern is what makes the event emitter, queue, RabbitMQ, and cron examples possible.

## Invoke Ownership

Most initializers only need metadata and startup wiring.

- invoke-enabled initializers extend `Initializer<TToken>` and receive `InitializerContext`
- metadata-only initializers extend `Initializer<TToken, false>` and receive `MetadataInitializerContext`

Only one invoke-enabled initializer may match a controller method. This keeps execution ownership explicit and avoids accidentally wiring the same method into multiple runtime entrypoints.

## Why This Matters

Initializers let you avoid framework-specific integration packages while still keeping a clean, decorator-driven API.

Compared to a system that needs dedicated integration packages for each transport or framework:

- the abstraction stays small
- the runtime wiring remains explicit
- you keep direct access to the native underlying API
- you can customize behavior without fighting framework adapters

## Modules And Reuse

An initializer is registered in a module, just like other module features.

It can also be exported from that module and then imported into another module.
That means you can package behavior once and reuse it across the app.

For example:

- an HTTP module can export its HTTP initializer
- a queue module can export its queue-job initializer
- an event module can export its event-listener initializer

Then another module can import that module and get the behavior without re-declaring the initializer locally.

This makes initializers a good way to ship reusable integration behavior at module boundaries, not just local startup code.

```typescript
import { createModule, type ModuleDef } from "awilixify";

class HttpInitializer {}

type HttpModuleDef = ModuleDef<{
	initializers: {
		http: HttpInitializer;
	};
	exportInitializerKeys: ["http"];
}>;

export const HttpModule = createModule<HttpModuleDef>({
	name: "HttpModule",
	initializers: {
		http: HttpInitializer,
	},
	initializerExports: ["http"],
});

type AppModuleDef = ModuleDef<{
	imports: [typeof HttpModule];
}>;

export const AppModule = createModule<AppModuleDef>({
	name: "AppModule",
	imports: [HttpModule],
});
```

## When To Reach For Initializers

Use an initializer when you need to register or connect something at startup:

- map decorators to framework routes
- subscribe handlers to an event bus
- register queue workers
- register message consumers
- schedule jobs

If the integration is about wiring a method into some external runtime, an initializer is usually the right tool.

For call-time method wrapping inside providers, see [Interceptors](/guide/interceptors).
