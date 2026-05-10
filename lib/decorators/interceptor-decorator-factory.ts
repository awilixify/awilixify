import {
	addInterceptorMethodMetadata,
	updateInterceptorState,
} from "./interceptor-state.js";
import type { InterceptorMetadataToken } from "../di/interceptor.types.js";

export function createInterceptDecorator<T>(token: InterceptorMetadataToken<T>) {
	return (value: unknown) =>
		(target: any, context: ClassMethodDecoratorContext) => {
			if (!context.metadata) return target;

			updateInterceptorState(context.metadata, (state) =>
				addInterceptorMethodMetadata(state, context.name, token, value),
			);

			return target;
		};
}
