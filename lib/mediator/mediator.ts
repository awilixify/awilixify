import type { DevtoolsProcessorRef } from "../devtools/devtools.types.js";
import { runInRequestScopeContext } from "../di/request-scope-context.js";
import type { AnyContract } from "./contract.types.js";
import * as errors from "./errors.js";
import type { Executor, ExtractPayload } from "./handler.types.js";
import type {
	ExecuteArgs,
	ExecuteResponse,
	ExecuteResponseByScenario,
	ExecuteRuntimeOptions,
	ExtractScenarioName,
} from "./mediator.types.js";
import type {
	AnyContext,
	ExecutionContext,
	Middleware,
	MiddlewareResolverMap,
} from "./middleware.types.js";
import { Result, type Result as ResultType } from "./result.js";

export class Mediator<C extends AnyContract> {
	private handlers = new Map<string, Executor>();
	private middlewareResolvers: MiddlewareResolverMap;
	private handlerType: string;
	private moduleName: string;
	private devtoolsProcessorRef: DevtoolsProcessorRef;

	constructor(
		middlewareResolvers: MiddlewareResolverMap,
		moduleName: string,
		handlerType = "handler",
		devtoolsProcessorRef: DevtoolsProcessorRef = {},
	) {
		this.handlerType = handlerType;
		this.moduleName = moduleName;
		this.middlewareResolvers = middlewareResolvers;
		this.devtoolsProcessorRef = devtoolsProcessorRef;
	}

	register(key: string, executor: Executor): void {
		const keyStr = String(key);

		if (this.handlers.has(keyStr)) {
			throw new errors.HandlerAlreadyRegisteredError(keyStr);
		}

		this.handlers.set(keyStr, executor);
	}

	// This overload pins `scenario` to a literal and returns only that
	// scenario's precomputed returnType. Without it, TS often widens options.
	async execute<K extends C["key"], Name extends ExtractScenarioName<C, K>>(
		key: K,
		payload: ExtractPayload<C, K>,
		options: ExecuteRuntimeOptions<C, K> & { scenario: Name },
	): Promise<ExecuteResponseByScenario<C, K, Name>>;

	async execute<
		K extends C["key"],
		TOptions extends ExecuteRuntimeOptions<C, K> = ExecuteRuntimeOptions<C, K>,
	>(
		key: K,
		payload: ExtractPayload<C, K>,
		...args: ExecuteArgs<C, K, TOptions>
	): Promise<ExecuteResponse<C, K>>;

	async execute<K extends C["key"]>(
		key: K,
		payload: ExtractPayload<C, K>,
		options?: ExecuteRuntimeOptions<C, K>,
	): Promise<unknown> {
		const execute = () =>
			runInRequestScopeContext(async () => {
				const keyStr = String(key);
				const executor = this.handlers.get(keyStr);

				if (!executor) {
					throw new errors.HandlerNotRegisteredError(keyStr, this.moduleName);
				}

				const {
					executionContext,
					includePreHandlerKeys,
					excludePreHandlerKeys,
				} = options ?? {};

				const applicableMiddlewares = this.resolveApplicableMiddlewares({
					excludePreHandlerKeys,
					includePreHandlerKeys,
				});

				const middlewareResult = await this.executeMiddlewares(
					applicableMiddlewares,
					payload,
					executionContext ?? {},
				);

				if (middlewareResult.type === "error") {
					return middlewareResult.error as unknown;
				}

				const handlerResult = await executor(payload, middlewareResult.context);

				if (middlewareResult.hasResultMiddleware) {
					return (
						this.isResult(handlerResult)
							? handlerResult
							: Result.ok(handlerResult)
					) as unknown;
				}

				return handlerResult as unknown;
			});

		return (
			this.devtoolsProcessorRef.current?.tracer.recordSpan({
				kind: "mediator",
				moduleName: this.moduleName,
				providerKey: this.getMediatorName(),
				methodName: "execute",
				args: [key, payload, options],
				callback: execute,
			}) ?? execute()
		);
	}

	private getMediatorName(): string {
		switch (this.handlerType) {
			case "query":
				return "QueryMediator";
			case "command":
				return "CommandMediator";
			default:
				return "Mediator";
		}
	}

	private async executeMiddlewares(
		middlewares: Array<[string, Middleware]>,
		payload: unknown,
		executionContext: ExecutionContext,
	): Promise<
		| { type: "success"; context: AnyContext; hasResultMiddleware: boolean }
		| { type: "error"; error: ResultType<never, unknown> }
	> {
		let context: AnyContext = {};
		let hasResultMiddleware = false;

		for (const [middlewareKey, middleware] of middlewares) {
			const result =
				await (this.devtoolsProcessorRef.current?.tracer.recordSpan({
					kind: "prehandler",
					moduleName: this.moduleName,
					providerKey: middleware.constructor.name,
					methodName: "execute",
					args: [payload, context, executionContext],
					callback: () =>
						middleware.execute(payload, context, executionContext),
				}) ?? middleware.execute(payload, context, executionContext));

			if (this.isResult(result)) {
				hasResultMiddleware = true;
			}

			const processed = this.processMiddlewareResult(
				result,
				context,
				middlewareKey,
			);

			if (processed.shouldShortCircuit) {
				return { type: "error", error: processed.result };
			}

			context = processed.context;
		}

		return { type: "success", context, hasResultMiddleware };
	}

	private processMiddlewareResult(
		result: unknown,
		currentContext: AnyContext,
		middlewareKey: string,
	):
		| { shouldShortCircuit: true; result: ResultType<never, unknown> }
		| { shouldShortCircuit: false; context: AnyContext } {
		if (this.isResult(result)) {
			return result.ok
				? {
						shouldShortCircuit: false,
						context: this.mergeContext(
							currentContext,
							result.value,
							middlewareKey,
						),
					}
				: { shouldShortCircuit: true, result };
		}

		return {
			shouldShortCircuit: false,
			context: this.mergeContext(currentContext, result, middlewareKey),
		};
	}

	private resolveApplicableMiddlewares(options?: {
		includePreHandlerKeys?: readonly string[];
		excludePreHandlerKeys?: readonly string[];
	}): Array<[string, Middleware]> {
		const { includePreHandlerKeys = [], excludePreHandlerKeys = [] } =
			options ?? {};

		const filtered = Array.from(this.middlewareResolvers.entries()).filter(
			([key]) => {
				if (excludePreHandlerKeys.includes(key)) {
					return false;
				}

				if (includePreHandlerKeys.length > 0) {
					return includePreHandlerKeys.includes(key);
				}

				return true;
			},
		);

		const resolvedMiddlewares = filtered.map<[string, Middleware]>(
			([key, resolver]) => [key, resolver()],
		);

		this.ensureMiddlewareDependencies(resolvedMiddlewares);

		return resolvedMiddlewares;
	}

	private ensureMiddlewareDependencies(
		middlewares: Array<[string, Middleware]>,
	): void {
		const processedKeys: string[] = [];

		for (const [key, middleware] of middlewares) {
			const requires = middleware.requires || [];

			for (const requiredKey of requires) {
				if (!processedKeys.includes(requiredKey)) {
					throw new errors.MiddlewareRequiredError(key, requiredKey);
				}
			}

			processedKeys.push(key);
		}
	}

	private mergeContext(
		currentContext: AnyContext,
		data: unknown,
		middlewareKey: string,
	): AnyContext {
		if (data === undefined) {
			return currentContext;
		}

		if (typeof data !== "object" || data === null) {
			const returnedType = data === null ? "null" : typeof data;
			throw new errors.InvalidMiddlewareReturnValueError(
				middlewareKey,
				returnedType,
			);
		}

		const currentKeys = Object.keys(currentContext);
		const newKeys = Object.keys(data);
		const conflictingKeys = newKeys.filter((key) => currentKeys.includes(key));

		if (conflictingKeys.length > 0) {
			throw new errors.ContextKeyConflictError(middlewareKey, conflictingKeys);
		}

		return { ...currentContext, ...data };
	}

	private isResult(value: unknown): value is ResultType<unknown, unknown> {
		return (
			typeof value === "object" &&
			value !== null &&
			"ok" in value &&
			typeof value.ok === "boolean"
		);
	}
}
