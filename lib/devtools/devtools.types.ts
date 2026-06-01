import type * as Awilix from "awilix";

import type { InternalModuleLike } from "../di/modules/runtime-module.types.js";
import type {
	ConstructorController,
	Initializer,
} from "../di/providers/provider.types.js";

export const AWILIXIFY_DEVTOOLS_PROCESSOR = "__awilixifyDevtoolsProcessor";

export type TraceSpanKind =
	| "http"
	| "provider"
	| "handler"
	| "prehandler"
	| "interceptor"
	| "initializer";

export type RecordSpanInput<T> = {
	kind: TraceSpanKind;
	moduleName: string;
	providerKey: string;
	methodName: string;
	args: unknown[];
	callback: () => T | Promise<T>;
	moduleId?: string;
};

export type WrapResolverInput = {
	kind: TraceSpanKind;
	module: InternalModuleLike;
	options: Awilix.BuildResolverOptions<any>;
	providerKey: string;
	resolver: Awilix.Resolver<any>;
	moduleId?: string;
	isFactory?: boolean;
};

export type TraceInitializerInput<T = unknown> = {
	args: unknown[];
	callback: () => T | Promise<T>;
	controllerName: string;
	getStatusCode: () => number | undefined;
	methodName: string;
	moduleName: string;
};

export interface Tracer {
	recordSpan<T>(input: RecordSpanInput<T>): T | Promise<T>;
	traceInitializer<T>(input: TraceInitializerInput<T>): T | Promise<T>;
	wrapResolver(input: WrapResolverInput): Awilix.Resolver<any>;
}

export type ModuleDecoratorMetadata = {
	module: InternalModuleLike;
	controllers: readonly {
		controllerClass: ConstructorController;
	}[];
	initializers: readonly [string, () => Initializer<any, boolean>][];
};

export interface GraphCollector {
	registerModule(input: {
		module: InternalModuleLike;
		scope: Awilix.AwilixContainer;
		importedModules: readonly InternalModuleLike[];
	}): string;
	collectModuleRoutes(metadata: ModuleDecoratorMetadata): void;
}

export type DevtoolsProcessorContext = {
	rootModule: InternalModuleLike;
	globalModules: readonly InternalModuleLike[];
};

export interface DevtoolsProcessor {
	graphCollector: GraphCollector;
	tracer: Tracer;
	initialize(context: DevtoolsProcessorContext): void;
}

export type DevtoolsProcessorRef = {
	current?: DevtoolsProcessor;
};
