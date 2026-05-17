import { createModule, type ModuleDef } from "awilixify";

import { CancellableInterceptor } from "./cancellable.interceptor.js";
import { TimeoutInterceptor } from "./timeout.interceptor.js";

type TimeoutModuleDef = ModuleDef<{
	interceptors: {
		timeout: TimeoutInterceptor;
		cancellable: CancellableInterceptor;
	};
	exportInterceptorKeys: ["timeout", "cancellable"];
}>;

export type Deps = TimeoutModuleDef["deps"];

export const TimeoutModule = createModule<TimeoutModuleDef>({
	name: "TimeoutModule",
	interceptors: {
		timeout: TimeoutInterceptor,
		cancellable: CancellableInterceptor,
	},
	interceptorExports: ["timeout", "cancellable"],
});
