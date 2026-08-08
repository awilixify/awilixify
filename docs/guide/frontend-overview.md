# Frontend Overview

Dependency injection is less common in frontend code than in backend systems.
But frontend applications can still benefit from explicit modules.
UI features often need:

- clear boundaries
- predictable communication between modules
- controlled access to shared services and infrastructure

The runtime environment is different, but module boundaries are still useful.

`awilixify` brings the same module-based DI mechanism to frontend code, so the same ideas can be used across backend and UI layers:

- define module boundaries explicitly
- expose only exported providers or components
- infer deps from the module definition
- keep module communication explicit

That means the same DI and module model can be used in a fullstack codebase while still keeping React components as the UI boundary.

For the concrete React API, see the [`@awilixify/react` guide](/docs/react).
