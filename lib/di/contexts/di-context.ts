import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import type { DiContextOptions } from "./di-context-base.js";
import { DIContextBase } from "./di-context-base.js";

export class DIContext extends DIContextBase {
	private constructor(options: DiContextOptions) {
		super(options);
	}

	static create(module: M, options?: DiContextOptions) {
		return new DIContext(options ?? {}).bootstrapModule(module);
	}
}
