import { onQueueJob } from "@/modules/queue/on-queue-job.decorator.js";
import { Type, type Static } from "@sinclair/typebox";
import { QueueJob, createQueueScope } from "@/modules/queue/queue.types.js";

export class CatsViewedQueueJob extends QueueJob<
	Static<(typeof CatsViewedQueueJob)["validationSchema"]>
> {
	static readonly queueName = "cats.viewed";
	static readonly validationSchema = Type.Object({
		catId: Type.String(),
		at: Type.Number(),
	});
}

export class CatsQueueListeners {
	static QueueScope = createQueueScope({
		enqueueable: {
			CatsViewedQueueJob,
		},
		processable: [CatsViewedQueueJob],
	});

	@onQueueJob(CatsViewedQueueJob)
	onCatsViewedQueueJob(payload: CatsViewedQueueJob["payload"]) {
		console.log("[CatsQueueListeners] queue job processed", payload);
	}
}
