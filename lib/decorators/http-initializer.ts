import { createInitializerDecorator } from "./controller-initializer-decorator-factory.js";
import { createControllerMetadataToken } from "./controller-initializer-state.js";

export const HTTP_INITIALIZER_TOKEN = createControllerMetadataToken<true>(
	"http-initializer",
);

const decorate = createInitializerDecorator(HTTP_INITIALIZER_TOKEN);

export function registerHttpRouteMarker() {
	return decorate(true);
}
