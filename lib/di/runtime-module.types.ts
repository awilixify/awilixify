import type { BuildResolverOptions } from "awilix";
import type { ForwardRef } from "./module-ref.types.js";
import type {
	AnyController,
	AnyControllerInitializer,
	AnyInterceptor,
	AnyMiddleware,
	AnyProvider,
} from "./provider.types.js";

// Internal lightweight module shape used by runtime processors.
// It intentionally avoids importing the heavy public module generic graph
// (StaticModule/ModuleDef helpers) to keep TS/LSP responsive in runtime files.
export interface InternalModuleLike {
	name: string;
	imports?: readonly (InternalModuleLike | ForwardRef<InternalModuleLike>)[];
	providers?: Record<string, AnyProvider>;
	exports?: Record<string, AnyProvider>;
	controllers?: AnyController[];
	registerControllers?: boolean;
	providerOptions?: Partial<BuildResolverOptions<any>>;
	queryHandlers?: readonly any[];
	commandHandlers?: readonly any[];
	queryPreHandlers?: Record<string, AnyMiddleware>;
	commandPreHandlers?: Record<string, AnyMiddleware>;
	queryPreHandlerExports?: Record<string, AnyMiddleware>;
	commandPreHandlerExports?: Record<string, AnyMiddleware>;
	interceptors?: Record<string, AnyInterceptor>;
	interceptorExports?: Record<string, AnyInterceptor>;
	controllerInitializers?: readonly AnyControllerInitializer[];
	controllerInitializerExports?: readonly AnyControllerInitializer[];
}
