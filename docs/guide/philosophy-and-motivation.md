# Philosophy and Motivation

## Why Created

I created awilixify because I wanted a modular system that stays explicit, type-safe, and transport-agnostic without forcing the whole application into a heavy framework model.

One concrete pain point was repetitive DI typing.
As projects grow, the same dependency types start getting re-declared and re-imported across services, handlers, and controllers.

But for me the bigger goal was not just reducing boilerplate.
I wanted module definitions to become the source of truth for wiring, boundaries, and allowed interactions, so business code can stay focused on business logic instead of framework ceremony.

## Explicit Interactions

I think code becomes manageable when interactions are explicit, boundaries are visible, and side effects are not hidden behind convenience abstractions.

I also think code becomes trustful when you can look at one module and understand:

- what it depends on
- what it exposes
- what side effects it can create

A lot of application complexity does not come from isolated classes.
It comes from how modules interact with each other and what side effects those interactions create.
With awilixify, I try to make those interactions as explicit as possible and to restrict them as much as possible at module boundaries.

One example is the event-emitter integration.
Instead of letting any module emit or listen to anything implicitly, I want a module to declare which events it is allowed to fire and which events it is allowed to listen to.

For me, that is where complexity becomes manageable.
The side effects stay explicit and reviewable, and you can look at a module definition and understand its boundaries without searching through the whole codebase.

Example:
[Event Emitter integration on GitHub](https://github.com/wildstyles/awilixify/tree/main/examples/fastify-cqrs/src/integrations/event-emitter)

## Transport Agnostic

I also did not want the system to assume that every application starts from an HTTP transport like Fastify or Express.

Sometimes the real entrypoint is not HTTP at all.
It can be cron jobs, RabbitMQ consumers, queue workers, event listeners, or a CLI process.

That is why the goal was not to build an HTTP framework abstraction.
The goal was to build a modular DI system that works for everything around the business layer and keeps transports at the boundary.

## Start Small

In real business projects, it is often unrealistic to start from scratch with a big framework or to rewrite everything at once.

I wanted awilixify to be something you can try on a very small part of the application first.
You should be able to modularize one feature, one integration, or one flow and then decide whether you actually like working with it.

That matters more to me than offering a huge all-in-one framework commitment from day one.
If the approach is good, it should prove itself on a small slice of a real application before it asks for broader adoption.

At the same time, starting small should not mean getting a toy subset.
Even when introduced incrementally, I still want it to be capable of replacing a full battery-included heavy framework, while staying smaller, more explicit, and easier to adopt step by step.

## Less Framework Code

I also think that less framework-dependent code is usually better.

It is always a good sign when you can actually read and understand how your framework works under the hood.
If the runtime model is small enough to be understandable, it becomes easier to trust, easier to debug, and easier to adapt to real business constraints.

awilixify was created with that in mind.
I wanted the core ideas to stay explicit and the implementation small enough that the user is not forced to treat the framework as magic.

## Middleware Problem

I think one of the worst parts of the broader JavaScript ecosystem is god-level type-unsafe middleware.

It can mutate request state however it wants, throw at any time, and hide business-important behavior inside framework plumbing that TypeScript cannot really describe well.
That makes the flow harder to trust, harder to review, and harder to reuse outside of one specific transport.

The pre-handler concept is my attempt to improve that.
The goal is to move business-relevant logic out of framework middleware and into something that is transport-aware, TypeScript-aware, and explicit in the execution flow.

That is also why `Result` and typed context matter here.
If middleware-like steps add data, enforce guarantees, or stop execution, those effects should become visible in types and visible in business code boundaries instead of remaining hidden inside framework callbacks.

For the concrete model, see the CQRS/pre-handler docs:

- [CQRS Pre-Handlers](/guide/cqrs-pre-handlers)
- [CQRS Scenarios](/guide/cqrs-scenarios)
