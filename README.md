# awilixify

> [!WARNING]
> This project is in active development and is not production-ready yet.

[![Build Status](https://github.com/wildstyles/awilixify/workflows/ci/badge.svg)](https://github.com/wildstyles/awilixify/actions)
[![codecov](https://codecov.io/gh/wildstyles/awilixify/branch/main/graph/badge.svg)](https://codecov.io/gh/wildstyles/awilixify)

📚 Documentation: https://wildstyles.github.io/awilixify/

A type-safe, modular DI and CQRS framework on top of [Awilix](https://github.com/jeffijoe/awilix) that brings NestJS-like module architecture with powerful CQRS capabilities to any Node.js application.

🚀 **includes native ES decorators (TC39 Stage 3) for routing - no `reflect-metadata` or `experimentalDecorators` required!**

## Features

- **Type-Safe Module System** - Complete type safety for each provider in module
- **HTTP Framework Agnostic** - Works with Express, Fastify, Hono, Koa, or any other framework
- **Powerful CQRS** - Type-safe query/command handlers with middleware pipeline, per-module mediators, and contract-based execution
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
