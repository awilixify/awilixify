import {
	createModule,
	type ModuleDef,
	type InferGlobalDependencies,
} from "awilixify";

import type { FastifyInstance } from "@/modules/http/types.js";
import { FastifyHttpInitializer } from "./fastify-http.initializer.js";
import { FastifyService } from "./fastify.service.js";
import { initializeFastify } from "./initialize-fastify.js";

export type HttpModuleDef = ModuleDef<{
	providers: {
		app: FastifyInstance;
		fastifyService: FastifyService;
	};
	initializers: {
		http: typeof FastifyHttpInitializer;
	};
	exportKeys: ["app"];
	exportInitializerKeys: ["http"];
}>;

export type Deps = HttpModuleDef["deps"];

export const HttpModule = createModule<HttpModuleDef>({
	name: "HttpModule",
	containerOptions: {
		injectionMode: "PROXY",
	},
	providers: {
		app: {
			eager: true,
			useFactory: initializeFastify,
		},
		fastifyService: {
			useClass: FastifyService,
			initAfter: ["config", "app"],
			eager: true,
		},
	},
	exports: ["app"],
	initializers: {
		http: FastifyHttpInitializer,
	},
	initializerExports: ["http"],
});

declare module "awilixify" {
	interface GlobalDependencies extends InferGlobalDependencies<HttpModuleDef> {}
}
