import { createModule, type ModuleDef } from "awilixify";

import { RetryInterceptor } from "./retry.interceptor.js";

type RetryModuleDef = ModuleDef<{
	interceptors: {
		retry: RetryInterceptor;
	};
	exportInterceptorKeys: ["retry"];
}>;

export const RetryModule = createModule<RetryModuleDef>({
	name: "RetryModule",
	interceptors: {
		retry: RetryInterceptor,
	},
	interceptorExports: ["retry"],
});
