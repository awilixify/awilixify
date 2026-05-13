import { createModule, type ModuleDef } from "awilixify";
import { Queue, Worker, type Processor } from "bullmq";

class BullMqRegistry {
	private readonly queues = new Map<string, Queue>();
	private readonly workers = new Map<string, Worker>();
	private readonly redisConnection = {
		host: "127.0.0.1",
		port: 6380,
	};

	public getQueue(queueName: string): Queue {
		const queue = this.queues.get(queueName);

		if (!queue) {
			throw new Error(`Queue with name "${queueName}" is not registered!`);
		}

		return queue;
	}

	public registerWorkerOrThrow(
		queueName: string,
		processor: Processor<unknown, unknown, string>,
	): Worker {
		if (this.workers.has(queueName)) {
			throw new Error(
				`Worker and Queue already registered for queue "${queueName}"`,
			);
		}

		const queue = new Queue(queueName, {
			connection: this.redisConnection,
		});
		const worker = new Worker<unknown, unknown, string>(queueName, processor, {
			connection: this.redisConnection,
		});

		worker.on("error", (error: unknown) => {
			console.error(`[Queue] worker failed for queue "${queueName}"`, error);
		});

		this.workers.set(queueName, worker);
		this.queues.set(queueName, queue);

		return worker;
	}
}

type BullMqCoreModuleDef = ModuleDef<{
	providers: {
		bullMqRegistry: BullMqRegistry;
	};
	exportKeys: ["bullMqRegistry"];
}>;

export const BullMqCoreModule = createModule<BullMqCoreModuleDef>({
	name: "BullMqCoreModule",
	providers: {
		bullMqRegistry: BullMqRegistry,
	},
	exports: ["bullMqRegistry"],
});
