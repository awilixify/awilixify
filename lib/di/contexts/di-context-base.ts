import type * as Awilix from "awilix";
import type { InternalModuleLike as M } from "../modules/runtime-module.types.js";
import { ControllerProcessor } from "../processors/controller-processor.js";
import {
	HandlerProcessor,
	HandlerType,
} from "../processors/handler-processor.js";
import { InitializerProcessor } from "../processors/initializer-processor.js";
import { InterceptorProcessor } from "../processors/interceptor-processor.js";
import { ProviderResolver } from "../providers/provider-resolver.js";
import {
	getOrCreateRequestScope,
	hasRequestScopeContext,
	resolveFromRequestScope,
} from "../request-scope-context.js";
import {
	ContainerContextBase,
	type ContainerContextOptions,
	type RegisteredModuleScope,
} from "./container-context-base.js";

export interface DiContextOptions extends ContainerContextOptions {
	skipRegisterRoutes?: boolean;
}

export class DIContextBase extends ContainerContextBase<DiContextOptions> {
	protected readonly controllerProcessor: ControllerProcessor;
	protected readonly handlerProcessor: HandlerProcessor;
	protected readonly interceptorProcessor: InterceptorProcessor;
	protected readonly initializerProcessor: InitializerProcessor;

	protected constructor(options: DiContextOptions) {
		super(options, {
			hasScopeContext: hasRequestScopeContext,
			resolveFromScope: resolveFromRequestScope,
		});

		this.handlerProcessor = new HandlerProcessor(
			this.options.providerOptions || {},
			this.devtoolsProcessorRef,
		);
		this.interceptorProcessor = new InterceptorProcessor(
			this.options.providerOptions || {},
			this.devtoolsProcessorRef,
		);
		this.initializerProcessor = new InitializerProcessor(
			this.devtoolsProcessorRef,
		);
		this.controllerProcessor = new ControllerProcessor(
			this.interceptorProcessor,
			this.options.providerOptions || {},
			this.options.skipRegisterRoutes === true,
			this.devtoolsProcessorRef,
		);
		this.providerResolver = new ProviderResolver(
			this.interceptorProcessor,
			this.options.providerOptions || {},
			this.devtoolsProcessorRef,
			getOrCreateRequestScope,
		);
	}

	protected beforeRegisterProviders(
		m: M,
		scope: Awilix.AwilixContainer,
		importedModulesWithScope: RegisteredModuleScope[],
	): void {
		this.interceptorProcessor.processInterceptors(
			m,
			scope,
			importedModulesWithScope,
		);
	}

	protected afterRegisterProviders(
		m: M,
		scope: Awilix.AwilixContainer,
		importedModulesWithScope: RegisteredModuleScope[],
	): void {
		this.handlerProcessor.processHandlers(
			m,
			scope,
			importedModulesWithScope,
			HandlerType.Query,
		);
		this.handlerProcessor.processHandlers(
			m,
			scope,
			importedModulesWithScope,
			HandlerType.Command,
		);
		const controllers = this.controllerProcessor.processControllers(m, scope);
		this.lifecycleProcessor.addInitializerTask(
			this.initializerProcessor.collectInitializers(
				m,
				scope,
				importedModulesWithScope,
				controllers,
			),
		);
	}
}
