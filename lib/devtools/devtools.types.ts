import type * as Awilix from "awilix";

import type { InternalModuleLike } from "../di/modules/runtime-module.types.js";
import type {
	ConstructorController,
	Initializer,
} from "../di/providers/provider.types.js";

export const AWILIXIFY_DEVTOOLS_PROCESSOR = "__awilixifyDevtoolsProcessor";

export type TraceSpanKind =
	| "controller"
	| "provider"
	| "mediator"
	| "handler"
	| "prehandler"
	| "interceptor";

export type RecordSpanInput<T> = {
	kind: TraceSpanKind;
	moduleName: string;
	className: string;
	registrationKey: string;
	methodName: string;
	args: unknown[];
	parameterNames?: string[];
	callback: () => T | Promise<T>;
	moduleId?: string;
	/**
	 * For interceptors: returns the duration spent in proceed() calls.
	 * Called after callback completes to calculate self-time.
	 */
	getProceedDurationMs?: () => number;
};

export type WrapResolverInput = {
	kind: TraceSpanKind;
	module: InternalModuleLike;
	options: Awilix.BuildResolverOptions<any>;
	className: string;
	registrationKey: string;
	resolver: Awilix.Resolver<any>;
	moduleId?: string;
	isFactory?: boolean;
};

export type RunInControllerTraceInput<T> = {
	moduleName: string;
	className: string;
	registrationKey: string;
	methodName: string;
	args: unknown[];
	callback: () => T | Promise<T>;
};

export interface Tracer {
	recordSpan<T>(input: RecordSpanInput<T>): T | Promise<T>;
	runInCurrentSpan<T>(callback: () => T | Promise<T>): T | Promise<T>;
	runInControllerTrace<T>(input: RunInControllerTraceInput<T>): T | Promise<T>;
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
