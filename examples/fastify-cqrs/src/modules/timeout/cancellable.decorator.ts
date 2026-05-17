import { createDecoratorStateUpdater } from "awilixify";

type CancellableMethodState = {
	cancellable?: true;
};

const updater = createDecoratorStateUpdater("cancellable", {
	method: (): CancellableMethodState => ({}),
});

export const CANCELLABLE_METADATA_TOKEN = updater.token;

export function cancellable() {
	return (_target: any, context: ClassMethodDecoratorContext) => {
		updater.update(context, {
			method: (previous) => ({
				...previous,
				cancellable: true,
			}),
		});
	};
}
