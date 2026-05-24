<div align="center">
  <img src="./logo.png" alt="awilixify logo" width="220" />
</div>

Transport-agnostic, type-safe, modular DI and CQRS framework on top of [Awilix](https://github.com/jeffijoe/awilix) that brings module architecture with powerful CQRS capabilities to Node.js applications and React 🚀 frontends.

[![Build Status](https://github.com/wildstyles/awilixify/workflows/ci/badge.svg)](https://github.com/wildstyles/awilixify/actions)
[![codecov](https://codecov.io/gh/wildstyles/awilixify/branch/main/graph/badge.svg)](https://codecov.io/gh/wildstyles/awilixify)

> [!WARNING]
> This project is in active development and is not production-ready yet.

📚 Documentation: https://wildstyles.github.io/awilixify/

## Features

- **Type-Safe Module System** - Complete type safety for each provider in module
- **Transport Agnostic** - Works with Express, Fastify, Queues, Rabbit or any other tranport
- **Fullstack Module Model** - Reuse the same DI module mechanism in Node.js and React applications
- **Powerful CQRS** - Type-safe query/command handlers with middleware pipeline, per-module mediators, and contract-based execution
- **Type-Level Middleware Composition** - Compose and inherit middleware with end-to-end type safety
- **No Experimental Decorators Required** - Uses native ES decorators (TC39 Stage 3) for routing without `reflect-metadata`
- **NestJS-Inspired Architecture** - Familiar module/controller/provider patterns
- **Less Import Boilerplate For Typing** - Define module dependencies once - reuse in all providers
- **Lightweight** - Minimal overhead, built on proven Awilix foundation

## Installation

```bash
npm install awilixify awilix
```

```bash
yarn add awilixify awilix
```

```bash
pnpm add awilixify awilix
```
