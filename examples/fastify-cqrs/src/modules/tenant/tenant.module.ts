import {
	createDynamicModule,
	type InferGlobalDependencies,
	type InferGlobalQueryPreHandlers,
	type ModuleDef,
} from "awilixify";
import type { FastifyInstance } from "@/types.js";
import { TenantMiddleware } from "./tenant.middleware.js";

export type TenantModuleDef = ModuleDef<{
	forRootConfig: {
		app: FastifyInstance;
	};
	providers: {
		app: FastifyInstance;
	};
	exportKeys: ["app"];
	queryPreHandlers: {
		tenant: TenantMiddleware;
	};
	exportQueryPreHandlerKeys: ["tenant"];
}>;

export const TenantModule = createDynamicModule<TenantModuleDef>((config) => ({
	name: "TenantModule",

	providers: {
		app: config.app,
	},

	exports: ["app"],

	queryPreHandlers: {
		tenant: TenantMiddleware,
	},

	queryPreHandlerExports: ["tenant"],
}));

declare module "awilixify" {
	interface GlobalDependencies
		extends InferGlobalDependencies<TenantModuleDef> {}

	interface GlobalQueryPreHandlers
		extends InferGlobalQueryPreHandlers<TenantModuleDef> {}
}
