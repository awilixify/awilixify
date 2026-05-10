# Philosophy and Motivation

### Why it was created

As projects grow, DI typing often becomes repetitive: every service re-declares and re-imports the same dependency types.

awilixify was created to make module definitions the source of truth for dependency typing and wiring, so business code stays focused on business logic - not on tens lines of imports.

### Core motivation

- remove repeated constructor typing/import boilerplate
- keep DI configuration in module definitions, not scattered in providers
- preserve strong type safety across module boundaries
- keep architecture framework-agnostic

### Key benefits

- **Single source of truth**: `ModuleDef` defines what is available in a module and what is exported.
- **Less boilerplate**: define dependencies once and reuse module-level dependency types everywhere.
- **Cleaner providers**: provider classes stay focused on behavior, not container setup details.
- **Stable boundaries**: contracts and module exports make coupling explicit and reviewable.
- **Framework independence**: business logic stays portable across HTTP, jobs, queues, and CLI flows.
- **Future-proof runtime model**: native JS decorators and explicit module config over reflection-heavy magic.

### Minimum overhead

Adds minimal understandable overhead for what it provides: `< 1500` runtime lines of code and `< 1500` type lines of code in source terms (excluding Awilix itself).

### Architectural direction

- modules own wiring and dependency boundaries
- handlers expose contracts, not implementation details
- mediator is the boundary between transport concerns and business operations
- scenarios make pre-handler execution explicit and type-checked per call, so middleware participates in the full flow by design
- errors are modeled explicitly (`Result`) and mapped at transport boundary
