# DevTools

Awilixify DevTools gives you a visual grasp of your application: its modules,
what they contain, and how they connect. When several services are loaded, that
view expands into a map of the microservice architecture rather than stopping
at one application's boundary.

It brings the same visibility to runtime behavior. Method-level traces show
which controllers, handlers, pre-handlers, interceptors, and providers
participated in an execution, together with their arguments, return values,
errors, timings, and console output.

## Motivation

Module definitions are useful because they make boundaries explicit in code,
but a large application is still difficult to hold in your head. The problem
becomes harder when one business flow crosses HTTP APIs, message brokers, and
multiple repositories or microservices.

Backend frameworks are usually good at helping you build and wire code, but
they rarely provide a visual way to understand the resulting system. Frontend
frameworks have made dedicated DevTools a normal part of development; backend
applications deserve the same level of visibility.

The aim is therefore broader than drawing one application's dependency graph.
It is to visualize the relationships across the whole system and pair that
architecture with real execution data. This is especially valuable for
microservice flows: you can see the work performed across services, including
the actual input and output of each method, without adding temporary
`console.log` calls throughout the codebase.

## How It Works

There are two independently distributed parts:

1. [`@awilixify/devtools`](https://github.com/awilixify/awilixify-devtools)
   runs inside each observed application. It integrates with the Awilixify
   lifecycle, collects the module graph, wraps runtime resolutions for tracing,
   and starts a separate DevTools API server.
2. The
   [DevTools UI](https://github.com/awilixify/awilixify-devtools-ui) is a web
   application distributed as a container image. It can connect to one or many
   DevTools API targets and combine them into a platform view.

The npm package does not contain or serve the UI. Keeping the observer and UI
separate lets one UI inspect several applications without adding frontend
assets to every service.

## Install and Register the Module

Install DevTools as a development dependency:

```sh
pnpm add -D @awilixify/devtools
```

Register `DevtoolsModule` in the application-wide `globalModules` list. It is a
global module, not a replacement for your application's root module.

```ts
import { DIContext } from "awilixify";

import { AppModule } from "./app.module.js";

const devtoolsModule =
  process.env.NODE_ENV === "development"
    ? (await import("@awilixify/devtools")).DevtoolsModule({
        serviceName: "orders",
      })
    : undefined;

const app = DIContext.create(AppModule, {
  globalModules: devtoolsModule ? [devtoolsModule] : [],
});

await app.init();
```

The conditional import keeps the package and its server out of the production
startup path. Once the application initializes, Awilixify gives the DevTools
processor access to the root module, global modules, resolved module scopes,
providers, controllers, and decorated entrypoints. The package then listens on
`http://127.0.0.1:3221` by default.

### Configuration

```ts
DevtoolsModule({
  serviceName: "orders",
  host: "0.0.0.0",
  port: 3221,
  appUrl: "http://127.0.0.1:3000",
  traceHistoryFile: ".awilixify-devtools/traces.json",
});
```

| Option             | Purpose                                                                                                                                                            |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `serviceName`      | Required stable identity for the application. Use lowercase letters, numbers, and single hyphens. It qualifies module and trace IDs and joins cross-service views. |
| `host`             | Network address on which the DevTools API listens. The default, `127.0.0.1`, accepts connections only from the same machine. Use `0.0.0.0` when the UI runs in Docker and needs to connect to a DevTools API running outside the container. |
| `port`             | DevTools API port. The default is `3221`; every service running on the same host needs a different port.                                                           |
| `appUrl`           | URL of the observed application. DevTools proxies non-DevTools requests to it so the UI can execute real HTTP routes through the same origin.                      |
| `traceHistoryFile` | Trace persistence file. The default is `.awilixify-devtools/traces.json`; set it to `false` for memory-only history.                                               |

The API is mounted under `/__devtools`. For example, the module graph is at
`http://127.0.0.1:3221/__devtools/graph`. OpenAPI documentation for the complete
API is available at `http://127.0.0.1:3221/api-docs`.

## Run the UI with Docker Compose

The UI container receives a list of observed applications through
`DEVTOOLS_TARGETS`:

```yaml
services:
  devtools-ui:
    image: ghcr.io/awilixify/awilixify-devtools-ui:0.1.1
    environment:
      DEVTOOLS_TARGETS: |
        - serviceName: orders
          url: http://host.docker.internal:3221
        - serviceName: warehouse
          url: http://host.docker.internal:3223
    ports:
      - "3222:3222"
    extra_hosts:
      - "host.docker.internal:host-gateway"
```

Start it and open `http://localhost:3222`:

```sh
docker compose up -d devtools-ui
```

Each target's `serviceName` must exactly match the value passed to that
application's `DevtoolsModule`. The example uses
`host.docker.internal` because the applications run on the host. On Linux,
`extra_hosts` maps that name to the host gateway. Also configure each observed
application with `host: "0.0.0.0"`, otherwise its API will only accept
connections from the host loopback interface.

If the applications and UI are services in the same Compose project, use the
Compose service names and keep the DevTools ports private instead:

```yaml
environment:
  DEVTOOLS_TARGETS: |
    - serviceName: orders
      url: http://orders:3221
    - serviceName: warehouse
      url: http://warehouse:3221
```

The container health endpoint is `/healthz`.

### Why Requests Go Through Nginx

Nginx serves the UI and creates a scoped proxy for every configured target. The
browser receives only a service name and a same-origin base path; it does not
receive the target's internal hostname or port.

- `/__devtools/orders/api/*` is rewritten to `/__devtools/*` on the Orders
  DevTools API.
- `/__devtools/orders/app/*` is rewritten to `/*` and proxied to the Orders
  application through the DevTools server's `appUrl` proxy.
- An unconfigured `/__devtools/*` path returns `404`.

This avoids exposing Docker DNS names and removes browser cross-origin concerns.
It does **not** make the DevTools endpoints secret or provide authentication.
The `/__devtools` namespace is still visible to the browser, and anyone who can
reach the UI can use its proxied capabilities.

::: warning Development access only
DevTools can inspect application structure, read captured request data, invoke
providers and handlers, replay application routes, and delete trace history.
Keep it disabled in production and do not expose the API or UI to untrusted
networks. Trace arguments, return values, headers, and console output may
contain sensitive data.
:::

## Module and Platform Graph

The graph turns the running DI model into something you can explore rather than
infer. It provides:

- root, feature, global, and dynamic modules, including import and global-module
  relationships;
- providers available in each scope, including exported/imported providers,
  implementation class, dependencies, lifetime, eager initialization, and
  circular-dependency settings;
- controllers, query and command handlers, pre-handlers, interceptors, and
  initializers;
- HTTP routes and non-HTTP entrypoints such as message consumers, events, or
  cron initializers discovered from decorator metadata;
- module search, provider search, related-module filtering, and grouping of
  dynamic module instances;
- a module inspector showing what a module contains, what it imports, and which
  modules use it.

### Connections Between Applications

When several targets are configured, the UI merges their graphs. Awilixify can
then connect an outgoing operation in one application to the owning entrypoint
or message consumer in another application.

The connection is explicit rather than guessed from URLs or queue names. Mark
outgoing HTTP or messaging calls with `callsOperation`, and mark message
publication with `publishesOperation`:

```ts
import { callsOperation, publishesOperation } from "awilixify";

const CreateReservation = {
  serviceName: "warehouse",
  operationId: "createReservation",
  transport: "http",
} as const;

class WarehouseClient {
  @callsOperation(CreateReservation)
  createReservation(input: unknown) {
    // Call the Warehouse API.
  }
}

class ReservationsService {
  @publishesOperation({ type: "reservation-created.v1" })
  publishReservationCreated() {
    // Publish the message.
  }
}
```

The service name and HTTP operation ID or messaging type provide the stable
join key. With the relevant services loaded as UI targets, the graph can draw
HTTP calls, messaging calls, and publisher-to-subscriber relationships across
application boundaries.

### Impact of Changed Files

The graph also relates the current Git working tree to DI providers. DevTools
reads staged, unstaged, added, deleted, and untracked files, uses the
application's `tsconfig.json` to inspect provider declarations, and marks
providers as:

- **added**, when a provider or its source file is new;
- **changed**, when its implementation or module registration changed;
- **deleted**, when it was removed from a module;
- **affected**, when it directly depends on an added, changed, or deleted
  provider.

Enable **Impact only** in graph settings to focus on those modules and
providers. This is useful before a review or test run: a small file diff can
have a larger runtime dependency surface, and the graph makes that surface
visible. Impact analysis uses the Git repository and TypeScript source visible
from the application's current working directory, so start the application
from the project directory containing its `tsconfig.json`.

## Playground and Runtime Control

The UI is not read-only. From the graph and Playground you can select an
application and module scope, inspect available methods, supply arguments, and
invoke a provider method. You can also execute query and command handlers,
pre-handlers, decorated non-HTTP entrypoints, and proxied HTTP routes. The UI
shows the returned value or invocation error, captured console output, and the
trace created by that execution.

This gives you direct control over application behavior at the same boundaries
the application uses internally. It is useful for isolating a provider or
reproducing a handler without manually building a temporary route. It is also
why DevTools must be treated as privileged development infrastructure: an
invoked method can perform any side effect that method normally performs.

## Tracing

A stack trace tells you where an exception ended up. An Awilixify trace shows
how an entire execution developed, including successful calls that produced
the wrong value before the visible failure.

For each HTTP request, Playground invocation, or decorated entrypoint,
DevTools records the boundary request and response, status, error, total
duration, and console output. Inside it, a nested span is recorded for each
observed controller, mediator, handler, pre-handler, interceptor, and provider
method. Each span includes:

- module, registration, class, and method identity;
- arguments passed to the method and its returned value;
- thrown errors and failed `Result` values;
- `console.log`, `console.info`, `console.warn`, and `console.error` calls made
  while that span is active;
- total duration and self-duration, which separates time in the method from
  time spent in traced child calls.

The visual call tree keeps parameters, return values, logs, errors, and timing
attached to the method that produced them. That makes it much easier to see the
first bad value, distinguish a slow provider from a slow dependency, find a
hidden downstream error, or notice that a side effect ran twice.

Trace values are converted to bounded JSON-safe previews. That protects the UI
from cycles and very large object graphs, but it is not a data-redaction policy.
Avoid putting secrets into traced arguments or logs, and protect persisted
trace files as development data. DevTools retains up to 50 recent traces and,
by default, persists them across restarts.

### Distributed Traces

Related service records share an Awilixify distributed trace ID encoded in a
W3C-compatible context value. Each service record also has its own span ID and
the upstream parent span ID, so the UI can assemble the service legs by
parentage rather than timestamp guesses.

Awilixify propagates this value with its own
`x-awilixify-trace-context` header. The standard `traceparent` header remains
owned by OpenTelemetry or another observability system, so both tracing systems
can be enabled without overwriting each other's context. Outgoing adapters must
forward the Awilixify context; use `getTracePropagationHeaders()` from
`awilixify/devtools`, or generated Awilixify clients that already add it:

```ts
import { getTracePropagationHeaders } from "awilixify/devtools";

await fetch(warehouseUrl, {
  headers: {
    ...getTracePropagationHeaders(),
  },
});
```

When all participating services are UI targets, the trace view combines their
records into one cross-service execution.

## Use Trace Data with an LLM

Trace data is particularly useful context for an LLM because it replaces a
vague report such as "the request failed" with structured runtime evidence:
the real inputs and outputs at every method boundary, console messages, error
semantics, timings, and the exact module/class/method coordinates that map back
to source.

This allows an agent to look for the first divergence from expected behavior
instead of guessing from the final response. It can compare a parent call with
a failed downstream service, distinguish thrown errors from returned failures,
identify duplicate calls, and verify a fix with before-and-after traces. Review
the trace first and share only the fields needed for diagnosis, because traces
can contain application data.

Awilixify provides a trace-debugging skill for Codex and Claude Code through
`@awilixify/cli`:

```sh
npx @awilixify/cli devtools init-ai
```

The installed skill discovers configured DevTools targets, reproduces the
reported request, correlates service traces, maps the first divergent span to
source, and uses a fresh trace to verify the fix.
