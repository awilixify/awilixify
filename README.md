# awilix-modular

[![Build Status](https://github.com/wildstyles/awilix-modular/workflows/ci/badge.svg)](https://github.com/wildstyles/awilix-modular/actions)
[![codecov](https://codecov.io/gh/wildstyles/awilix-modular/branch/main/graph/badge.svg)](https://codecov.io/gh/wildstyles/awilix-modular)

📚 Documentation: https://wildstyles.github.io/awilix-modular/

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
npm install awilix-modular awilix
```

```bash
yarn add awilix-modular awilix
```

```bash
pnpm add awilix-modular awilix
```
