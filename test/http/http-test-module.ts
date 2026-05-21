import { vi } from "vitest";
import type { AnyModule } from "../../lib/di/modules/module.types.js";
import { createModule } from "../../lib/di/modules/module-factories.js";
import type { InitializerContext } from "../../lib/di/providers/provider.types.js";
import { Initializer } from "../../lib/di/providers/provider.types.js";
import {
	HTTP_DECORATOR_STATE_TOKEN,
	rollUpHttpDecoratorState,
} from "../../lib/http/decorators.js";

type HttpToken = typeof HTTP_DECORATOR_STATE_TOKEN;

type MockExpressReply = {
	headersSent?: boolean;
	send: (body: unknown) => unknown;
};

type ExpressApp = {
	get: ReturnType<typeof vi.fn>;
	post: ReturnType<typeof vi.fn>;
};

class TestHttpInitializer extends Initializer<HttpToken> {
	public readonly token = HTTP_DECORATOR_STATE_TOKEN;

	constructor(private readonly app: ExpressApp) {
		super();
	}

	initialize(context: InitializerContext<HttpToken>) {
		const methodState = rollUpHttpDecoratorState(
			context.decoratorState.root,
			context.metadata,
		);

		for (const verb of methodState.verbs) {
			for (const path of methodState.paths) {
				const handler = (request: unknown, reply: MockExpressReply) =>
					context.invoke(request, reply);

				const handlers = [...methodState.beforeMiddleware];
				handlers.push(async (req, res, next) => {
					try {
						const result = await handler(req, res);
						if (result !== undefined && !res.headersSent) {
							res.send(result);
						}
					} catch (error) {
						next(error);
					}
				});

				this.app[verb.toLowerCase()](path, ...handlers);
			}
		}
	}
}

export const createMockExpress = () => {
	const app = {} as ExpressApp;
	app.get = vi.fn();
	app.post = vi.fn();

	return app;
};

export function createHttpTestModule(app: ExpressApp): AnyModule {
	return createModule({
		containerOptions: { injectionMode: "CLASSIC" },
		name: "HttpTestModule",
		providers: {
			app,
		},
		exports: ["app"],
		initializers: {
			http: TestHttpInitializer,
		},
		initializerExports: ["http"],
	});
}
