import {
	addControllerMethodMetadata,
	type ControllerMetadataToken,
	updateInitializerState,
} from "./controller-initializer-state.js";

export function createInitializerDecorator<T>(
	token: ControllerMetadataToken<T>,
) {
	return (value: T) =>
		(target: any, context: ClassMethodDecoratorContext) => {
			if (!context.metadata) return target;

			updateInitializerState(context.metadata, (state) =>
				addControllerMethodMetadata(state, context.name, token, value),
			);

			return target;
		};
}
