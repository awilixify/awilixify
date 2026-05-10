---
layout: home

hero:
  name: awilixify
  text: Type-safe, modular DI and CQRS
  tagline: HTTP-framework-agnostic architecture with explicit module boundaries, typed contracts, and minimal runtime overhead.
  actions:
    - theme: brand
      text: Getting Started
      link: /docs/quick-start
    - theme: alt
      text: View on GitHub
      link: https://github.com/wildstyles/awilixify

features:
  - title: Type-Safe Module System
    details: Define module dependencies once and reuse strongly typed module deps across services, handlers, and controllers.

  - title: Framework Agnostic
    details: Keep business logic portable across Express, Fastify, Hono, Koa, jobs, queues, and CLI.

  - title: End-to-end type safety across middleware flow
    details: Scenarios explicitly select pre-handlers with type checks, making middleware part of the same typed execution flow as handlers.

  - title: CQRS
    details: Execute commands and queries with contracts, payload, context, and error guarantees.

  - title: Native standard decorators
    details: Uses native ES decorators instead of legacy experimental semantics, with clearer runtime behavior and long-term compatibility.

  - title: Minimal Overhead
    details: Minimal runtime overhead(<1500 lines), built on top of Awilix without heavy reflection magic.
---
