import type { Initializer } from "awilixify";
import {
	HTTP_INITIALIZER_TOKEN,
	getClassHttpDecoratorState,
	type IHttpDecoratorState,
	InitializerContext,
} from "awilixify";

import type { Deps } from "./http.module.js";

export class FastifyHttpInitializer implements Initializer<true> {
	public readonly token = HTTP_INITIALIZER_TOKEN;
	private readonly registeredMethods = new Set<string>();

	constructor(private readonly app: Deps["app"]) {}

	initialize(context: InitializerContext<true>) {
		const methodKey = `${context.controllerClass.name}:${String(context.methodName)}`;

		if (this.registeredMethods.has(methodKey)) return;

		this.registeredMethods.add(methodKey);

		const state = getClassHttpDecoratorState(context.controllerClass);
		if (!state) return;

		const methodState = this.rollUpDecoratedState(state).get(
			context.methodName,
		);
		if (!methodState) return;

		for (const verb of methodState.verbs) {
			for (const path of methodState.paths) {
				this.app.route({
					method: verb,
					url: path,
					handler: (req: unknown, res: unknown) => context.invoke(req, res),
					preHandler: methodState.beforeMiddleware,
					schema: methodState.schema,
				});
			}
		}
	}

	private rollUpDecoratedState(
		state: IHttpDecoratorState,
	): IHttpDecoratorState["methods"] {
		const result: IHttpDecoratorState["methods"] = new Map();

		state.methods.forEach((method, key) => {
			result.set(key, {
				paths: this.concatPaths(state.root.paths, method.paths),
				beforeMiddleware: [
					...state.root.beforeMiddleware,
					...method.beforeMiddleware,
				],
				afterMiddleware: [
					...method.afterMiddleware,
					...state.root.afterMiddleware,
				],
				verbs: method.verbs,
				schema: method.schema,
			});
		});

		return result;
	}

	private concatPaths(rootPaths: string[], methodPaths: string[]): string[] {
		if (rootPaths.length === 0) {
			return [...methodPaths];
		}

		const result: string[] = [];
		rootPaths.forEach((rootPath) => {
			methodPaths.forEach((methodPath) => {
				result.push(rootPath + methodPath);
			});
		});

		return result;
	}
}
