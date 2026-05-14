import type { BuildResolverOptions } from "awilix";
import type {
	AnyController,
	AnyInitializer,
	AnyInterceptor,
	AnyMiddleware,
	AnyProvider,
} from "../providers/provider.types.js";
import type { ForwardRef } from "./module-ref.types.js";

// Internal lightweight module shape used by runtime processors.
// It intentionally avoids importing the heavy public module generic graph
// (Module/ModuleDef helpers) to keep TS/LSP responsive in runtime files.
export interface InternalModuleLike {
	name: string;
	imports?: readonly (
		| InternalModuleLike
		| Promise<InternalModuleLike>
		| ForwardRef<InternalModuleLike>
	)[];
	providers?: Record<string, AnyProvider>;
	exports?: readonly string[];
	controllers?: AnyController[];
	registerControllers?: boolean;
	providerOptions?: Partial<BuildResolverOptions<any>>;
	queryHandlers?: readonly any[];
	commandHandlers?: readonly any[];
	queryPreHandlers?: Record<string, AnyMiddleware>;
	commandPreHandlers?: Record<string, AnyMiddleware>;
	queryPreHandlerExports?: readonly string[];
	commandPreHandlerExports?: readonly string[];
	interceptors?: Record<string, AnyInterceptor>;
	interceptorExports?: readonly string[];
	initializers?: Record<string, AnyInitializer>;
	initializerExports?: readonly string[];
}
