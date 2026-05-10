import { createStaticModule, type ModuleDef } from "awilixify";
import { BullMqCoreModule } from "./bullmq-core.module.js";
import { QueueJobInitializer } from "./queue-job.initializer.js";
import { QueueService } from "./queue.service.js";
import type {
	AnyQueueJobConstructor,
	QueueModuleConfig,
} from "./queue.types.js";

type QueueModuleProviders<
	TEnqueueable extends Record<string, AnyQueueJobConstructor>,
> = {
	enqueueableJobs: TEnqueueable;
	processableJobs: readonly AnyQueueJobConstructor[];
	queue: QueueService<TEnqueueable>;
} & Record<string, object | string | boolean | number>;

type QueueModuleDef<
	TEnqueueable extends Record<string, AnyQueueJobConstructor>,
> = ModuleDef<{
	providers: QueueModuleProviders<TEnqueueable>;
	exportKeys: ["queue"];
	imports: [typeof BullMqCoreModule];
	initializers: {
		onQueueJob: typeof QueueJobInitializer;
	};
	exportInitializerKeys: ["onQueueJob"];
}>;

export type Deps = QueueModuleDef<
	Record<string, AnyQueueJobConstructor>
>["deps"];

export function QueueModule<const TConfig extends QueueModuleConfig>(
	config: TConfig,
) {
	return createStaticModule<QueueModuleDef<TConfig["enqueueable"]>>(
		{
			name: "QueueModule",
			imports: [BullMqCoreModule],
			providers: {
				enqueueableJobs: config.enqueueable,
				processableJobs: config.processable,
				queue: QueueService,
			},
			initializers: {
				onQueueJob: QueueJobInitializer,
			},
			exports: ["queue"],
			initializerExports: ["onQueueJob"],
		},
		{ hashNameFrom: config },
	);
}
