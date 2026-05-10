import { createStaticModule, type ModuleDef } from "awilixify";

import type { FastifyInstance } from "@/types.js";
import { FastifyHttpInitializer } from "./fastify-http.initializer.js";

export type HttpModuleDef = ModuleDef<{
	providers: {
		app: FastifyInstance;
	};
	initializers: {
		http: typeof FastifyHttpInitializer;
	};
	exportInitializerKeys: ["http"];
}>;

export type Deps = HttpModuleDef["deps"];

export function HttpModule(app: FastifyInstance) {
	return createStaticModule<HttpModuleDef>({
		name: "HttpModule",
		providers: {
			app,
		},
		initializers: {
			http: FastifyHttpInitializer,
		},
		initializerExports: ["http"],
	});
}
