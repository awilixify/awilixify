# Awilixify: NestJS-Like Architecture Without Rewriting Your Application

Every team wants best possible developer experience in the projects they maintain. We want tools that improve architecture, boundaries, and testability. That is exactly what frameworks are good at providing.

Unfortunately, legacy applications and modern frameworks are often not aligned.

Frameworks often take an all-or-nothing approach. They do not just add structure to your application; they take over the bootstrap. Instead of your existing `app.listen(...)` the framework expects you to start the app through its own runtime.

That is fine for a greenfield project. In a production Node.js application, it is a risk. The server already exists. Routes are already registered. Middleware order already matters. You usually do not want to touch everything at once, because every change can affect existing behavior. A safer migration is step by step: introduce better structure in new or isolated parts of the system without touching the parts that already work.

Awilixify focuses on gradual adoption: split your codebase into DI modules that can be used from any application, without touching existing bootstrap logic.

```ts
const app = express();

app.use(authMiddleware);
app.use(metricsMiddleware);
app.use("/api/users", usersRouter);

// added part to existing application which gives modular DI
const context = DIContext.create(AppModule, globalModules: [ExpressModule(app)]);

app.listen(3000);
```
