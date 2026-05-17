import {
	createModule,
	type InferGlobalQueryPreHandlers,
	type ModuleDef,
} from "awilixify";
import { TenantMiddleware } from "./tenant.middleware.js";

export type TenantModuleDef = ModuleDef<{
	queryPreHandlers: {
		tenant: TenantMiddleware;
	};
	exportQueryPreHandlerKeys: ["tenant"];
}>;

export function TenantModule() {
	return createModule<TenantModuleDef>({
		name: "TenantModule",

		queryPreHandlers: {
			tenant: TenantMiddleware,
		},

		queryPreHandlerExports: ["tenant"],
	});
}

declare module "awilixify" {
	interface GlobalQueryPreHandlers
		extends InferGlobalQueryPreHandlers<TenantModuleDef> {}
}
