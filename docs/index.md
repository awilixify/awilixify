---
layout: home

hero:
  name: awilixify
  text: Type-safe, modular DI and CQRS
  tagline: Transport-agnostic architectural framework with explicit module boundaries, typed contracts, and minimal runtime overhead.
  actions:
    - theme: brand
      text: Getting Started
      link: /docs/quick-start
    - theme: alt
      text: Why awilixify?
      link: /docs/philosophy-and-motivation

features:
  - title: Type-Safe Module System
    details: Define module dependencies once and reuse strongly typed module deps across services, handlers, and controllers.

  - title: Transport Agnostic
    details: Keep business logic portable across Express, Fastify, Hono, Koa, jobs, queues or whatever you need.

  - title: End-to-end type safety across middleware flow
    details: Scenarios explicitly select pre-handlers with type checks, making middleware part of the same typed execution flow as handlers.

  - title: CQRS
    details: Execute commands and queries with contracts, payload, context, and error guarantees.

  - title: Native standard decorators
    details: Uses native ES decorators instead of legacy experimental semantics, with clearer runtime behavior and long-term compatibility.

  - title: Minimal Overhead
    details: Minimal runtime overhead(<2500 lines), built on top of Awilix without heavy reflection magic.
---
