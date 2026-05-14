import type { EmptyObject } from "../di/common.types.js";
import type { DefPreHandlerMap } from "../di/providers/provider.types.js";

// biome-ignore lint/suspicious/noEmptyInterface: Intentionally empty for declaration merging
export interface GlobalQueryPreHandlers {}

// biome-ignore lint/suspicious/noEmptyInterface: Intentionally empty for declaration merging
export interface GlobalCommandPreHandlers {}

export type NormalizeGlobalPreHandlerMap<T> = [T] extends [DefPreHandlerMap]
	? T
	: EmptyObject;

export type InferGlobalQueryPreHandlers<TModuleDef> = TModuleDef extends {
	queryPreHandlerExports: infer TPreHandlers;
}
	? NormalizeGlobalPreHandlerMap<TPreHandlers>
	: EmptyObject;

export type InferGlobalCommandPreHandlers<TModuleDef> = TModuleDef extends {
	commandPreHandlerExports: infer TPreHandlers;
}
	? NormalizeGlobalPreHandlerMap<TPreHandlers>
	: EmptyObject;
