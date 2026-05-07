import {
	addControllerMethodMetadata,
	type ControllerMetadataToken,
	updateControllerInitializerState,
} from "./controller-initializer-state.js";

export function createControllerInitializerDecorator<T>(
	token: ControllerMetadataToken<T>,
) {
	return (value: T) =>
		(target: any, context: ClassMethodDecoratorContext) => {
			if (!context.metadata) return target;

			updateControllerInitializerState(context.metadata, (state) =>
				addControllerMethodMetadata(state, context.name, token, value),
			);

			return target;
		};
}
