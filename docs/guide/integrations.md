# Integrations

Full working integration examples live in the Fastify CQRS example app.

The important part is not Fastify itself.
The important part is the model:

- decorators describe intent
- initializers wire runtime behavior
- integrations stay declarative at the module/controller level
- the actual implementation still uses the full native API of the underlying technology

This means you can build almost any integration you want in a declarative way while still using the native underlying framework or library directly.

The only real downside is that you write a bit more manual integration code yourself.
That tradeoff is usually worth it because you avoid adding framework-specific packages just to get one integration style.

## Integration examples

- [Fastify integration(silimar for any another HTTP framework)](https://github.com/awilixify/awilixify/tree/main/examples/fastify-cqrs/src/integrations/http)
- [Config](https://github.com/awilixify/awilixify/tree/main/examples/fastify-cqrs/src/integrations/config)
- [Kysely Query Builder with explicit read/write rights per module](https://github.com/awilixify/awilixify/tree/main/examples/fastify-cqrs/src/integrations/db)
- [Cache](https://github.com/awilixify/awilixify/tree/main/examples/fastify-cqrs/src/integrations/cache)
- [Retry](https://github.com/awilixify/awilixify/tree/main/examples/fastify-cqrs/src/integrations/retry)
- [Timeout](https://github.com/awilixify/awilixify/tree/main/examples/fastify-cqrs/src/integrations/timeout)
- [Scheduler, Cron](https://github.com/awilixify/awilixify/tree/main/examples/fastify-cqrs/src/integrations/scheduler)
- [Event Emitter](https://github.com/awilixify/awilixify/tree/main/examples/fastify-cqrs/src/integrations/event-emitter)
- [Queue / BullMQ](https://github.com/awilixify/awilixify/tree/main/examples/fastify-cqrs/src/integrations/queue)
- [RabbitMQ](https://github.com/awilixify/awilixify/tree/main/examples/fastify-cqrs/src/integrations/rabbitmq)
