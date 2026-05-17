import { createDecoratorStateUpdater } from "awilixify";
import type { AnyQueueJobConstructor } from "./queue.types.js";

const updater = createDecoratorStateUpdater("on-queue-job", {
	method: (): AnyQueueJobConstructor => undefined as never,
});

export const ON_QUEUE_JOB_METADATA_TOKEN = updater.token;

export function onQueueJob(job: AnyQueueJobConstructor) {
	return (target: any, context: ClassMethodDecoratorContext) => {
		updater.update(context, { method: () => job });

		return target;
	};
}
