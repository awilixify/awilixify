# OpenAPI/Swagger Integration

Awilix-modular provides `OpenAPIBuilder` to automatically generate OpenAPI/Swagger documentation from route schemas. This works seamlessly with JSON Schema libraries like TypeBox.

> [!NOTE]
> **This is particularly useful for Express applications.** Fastify and Hono already provide schema validation and OpenAPI generation out of the box through their ecosystems (`@fastify/swagger`, `@hono/zod-openapi`). For Express and other frameworks without built-in schema support, `OpenAPIBuilder` bridges this gap by providing similar functionality.

### Using OpenAPIBuilder with beforeRouteRegistered Hook

The `beforeRouteRegistered` hook allows you to intercept route registration to:

1. Build OpenAPI/Swagger documentation from schema decorators
2. Set up custom validation middleware based on JSON schemas

```typescript
import { DIContext, OpenAPIBuilder } from "awilix-modular";
import express from "express";
import Ajv from "ajv";
import swaggerUi from "swagger-ui-express";

const app = express();
const openapiBuilder = new OpenAPIBuilder();
const ajv = new Ajv({ coerceTypes: true, removeAdditional: true });

DIContext.create(AppModule, {
  framework: app,
  beforeRouteRegistered: ({ method, path, schema }) => {
    // 1. Register route for OpenAPI documentation
    openapiBuilder.registerRoute(method, path, schema);

    // 2. Create custom validation middleware from JSON schema
    const validate = ajv.compile({
      type: "object",
      properties: {
        ...(schema.body && { body: schema.body }),
        ...(schema.querystring && { query: schema.querystring }),
        ...(schema.params && { params: schema.params }),
        ...(schema.headers && { headers: schema.headers }),
      },
    });

    // Return middleware to be applied to this route
    return [
      (req, res, next) => {
        const valid = validate({
          body: req.body,
          query: req.query,
          params: req.params,
          headers: req.headers,
        });

        if (!valid) {
          return res.status(400).json({
            error: "Validation failed",
            details: validate.errors,
          });
        }
        next();
      },
    ];
  },
});

const openapiSpec = {
  openapi: "3.0.0",
  info: {
    title: "My API",
    description: "API with automatic OpenAPI generation",
  },
  paths: openapiBuilder.buildPaths(),
};

// Setup Swagger UI
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openapiSpec));

// Start server
app.listen(3000, () => {
  console.log("Server: http://localhost:3000");
  console.log("API Docs: http://localhost:3000/api-docs");
});
```

> [!TIP]
> The `beforeRouteRegistered` hook returns an array of middleware functions that will be automatically applied to the route before your handler executes. This is perfect for validation, authentication, or logging middleware.
