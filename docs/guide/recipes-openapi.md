# OpenAPI

For frameworks like Express, OpenAPI generation fits naturally into the initializer approach.

The initializer can:

- read HTTP decorator metadata
- register Express routes
- attach validation middleware
- collect route schemas into `OpenAPIBuilder`

Then a separate eager provider can expose `/api-docs` in `postInit()`.

Full example:
[HTTP integration on GitHub](https://github.com/wildstyles/awilixify/tree/main/examples/fastify-cqrs/src/integrations/http)

## Express Example

```typescript
import Ajv from "ajv";
import type { Express, Request, Response, NextFunction } from "express";
import swaggerUi from "swagger-ui-express";

import {
  type Initializer,
  type InitializerContext,
  createModule,
} from "awilixify";
import {
  OpenAPIBuilder,
  HTTP_DECORATOR_STATE_TOKEN,
  type RouteSchema,
  hasValidationSchema,
  rollUpHttpDecoratorState,
} from "awilixify/http";

type HttpToken = typeof HTTP_DECORATOR_STATE_TOKEN;

const ajv = new Ajv({ coerceTypes: true, removeAdditional: true });

function createValidationMiddleware(schema: RouteSchema) {
  if (!hasValidationSchema(schema)) return null;

  const validate = ajv.compile({
    type: "object",
    properties: {
      ...(schema.body && { body: schema.body }),
      ...(schema.querystring && { querystring: schema.querystring }),
      ...(schema.params && { params: schema.params }),
      ...(schema.headers && { headers: schema.headers }),
    },
  });

  return (req: Request, _res: Response, next: NextFunction) => {
    const valid = validate({
      body: req.body,
      querystring: req.query,
      params: req.params,
      headers: req.headers,
    });

    if (!valid) {
      next(new Error("Validation failed"));
      return;
    }

    next();
  };
}

class OpenApiDocsService {
  private readonly openapiBuilder = new OpenAPIBuilder();

  constructor(private readonly app: Deps["app"]) {}

  registerRoute(method: string, path: string, schema: RouteSchema) {
    this.openapiBuilder.registerRoute(method, path, schema);
  }

  postInit() {
    const spec = {
      openapi: "3.0.0",
      info: {
        title: "My API",
        version: "1.0.0",
      },
      paths: this.openapiBuilder.buildPaths(),
    };

    this.app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(spec));
  }
}

class ExpressHttpInitializer implements Initializer<HttpToken> {
  public readonly token = HTTP_DECORATOR_STATE_TOKEN;

  constructor(
    private readonly app: Deps["app"],
    private readonly openApiDocs: Deps["openApiDocs"],
  ) {}

  initialize(context: InitializerContext<HttpToken>) {
    const methodState = rollUpHttpDecoratorState(
      context.decoratorState.root,
      context.metadata,
    );

    for (const verb of methodState.verbs) {
      for (const path of methodState.paths) {
        this.openApiDocs.registerRoute(verb, path, methodState.schema);

        const validation = createValidationMiddleware(methodState.schema);

        this.app[verb.toLowerCase()](
          path,
          ...methodState.beforeMiddleware,
          ...(validation ? [validation] : []),
          (req, res) => context.invoke(req, res),
        );
      }
    }
  }
}

const HttpModule = createModule({
  name: "HttpModule",
  providers: {
    app: express(),
    openApiDocs: {
      eager: true,
      useClass: OpenApiDocsService,
    },
  },
  initializers: {
    http: ExpressHttpInitializer,
  },
  initializerExports: ["http"],
});
```

## Why Split It This Way

The initializer handles route-time concerns:

- read metadata
- build middleware
- register handlers
- collect OpenAPI routes

The eager provider handles startup-time publishing:

- aggregate the `OpenAPIBuilder`
- expose `/api-docs` in `postInit()`

This keeps responsibilities clean and matches the awilixify lifecycle model.

For the underlying runtime model, see [Initializers](/guide/initializers) and [Lifecycle](/guide/lifecycle).
