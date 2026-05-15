import {
	createModule,
	type ModuleDef,
	type InferGlobalDependencies,
} from "awilixify";

import type { FastifyInstance } from "@/types.js";
import { FastifyHttpInitializer } from "./fastify-http.initializer.js";

export type HttpModuleDef = ModuleDef<{
	providers: {
		app: FastifyInstance;
	};
	initializers: {
		http: typeof FastifyHttpInitializer;
	};
	exportKeys: ["app"];
	exportInitializerKeys: ["http"];
}>;

export type Deps = HttpModuleDef["deps"];

export function HttpModule(app: FastifyInstance) {
	return createModule<HttpModuleDef>({
		name: "HttpModule",
		providers: {
			app,
		},
		exports: ["app"],
		initializers: {
			http: FastifyHttpInitializer,
		},
		initializerExports: ["http"],
	});
}

declare module "awilixify" {
	interface GlobalDependencies extends InferGlobalDependencies<HttpModuleDef> {}
}
