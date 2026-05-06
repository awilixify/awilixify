import {
	setInterceptorMetadata,
	updateInterceptorState,
} from "./interceptor-state.js";

export function createInterceptDecorator(key: string) {
	return (value: unknown) =>
		(target: any, context: ClassMethodDecoratorContext) => {
			if (!context.metadata) return target;

			updateInterceptorState(context.metadata, (state) =>
				setInterceptorMetadata(state, context.name, key, value),
			);

			return target;
		};
}
