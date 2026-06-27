# Fastify CQRS Example

Example demonstrating Awilixify with Fastify, CQRS, and TypeBox.

## Getting Started

Build Awilixify from the repository root:

```sh
pnpm build
```

Start the example and its infrastructure:

```sh
cd examples/fastify-cqrs
docker compose up -d
pnpm install
pnpm dev
```

The application runs at `http://localhost:3000`. In development, its DevTools
API runs separately at `http://127.0.0.1:3221`.

To develop the DevTools UI, open another terminal:

```sh
cd ../../../awilixify-devtools
pnpm install
pnpm build:devtools
pnpm dev
```

Open `http://localhost:3222`.
