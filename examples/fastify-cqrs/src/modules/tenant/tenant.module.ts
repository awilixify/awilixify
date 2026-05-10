import {
	createStaticModule,
	type InferGlobalDependencies,
	type InferGlobalQueryPreHandlers,
	type ModuleDef,
} from "awilixify";
import type { FastifyInstance } from "@/types.js";
import { TenantMiddleware } from "./tenant.middleware.js";

export type TenantModuleDef = ModuleDef<{
	providers: {
		app: FastifyInstance;
	};
	exportKeys: ["app"];
	queryPreHandlers: {
		tenant: TenantMiddleware;
	};
	exportQueryPreHandlerKeys: ["tenant"];
}>;

export function TenantModule(app: FastifyInstance) {
	return createStaticModule<TenantModuleDef>({
		name: "TenantModule",

		providers: {
			app,
		},

		exports: ["app"],

		queryPreHandlers: {
			tenant: TenantMiddleware,
		},

		queryPreHandlerExports: ["tenant"],
	});
}

declare module "awilixify" {
	interface GlobalDependencies
		extends InferGlobalDependencies<TenantModuleDef> {}

	interface GlobalQueryPreHandlers
		extends InferGlobalQueryPreHandlers<TenantModuleDef> {}
}
