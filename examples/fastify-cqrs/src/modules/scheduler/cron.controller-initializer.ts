import type { ControllerInitializer } from "awilix-modular";
import { CRON_METADATA_TOKEN, type CronMetadata } from "./cron.decorator.js";
import type { Deps } from "./scheduler.module.ts";

export class CronControllerInitializer
	implements ControllerInitializer<CronMetadata>
{
	public readonly token = CRON_METADATA_TOKEN;

	constructor(private readonly cronScheduler: Deps["cronScheduler"]) {}

	initialize(context: {
		moduleName: string;
		controllerClass: new (...args: any[]) => any;
		methodName: string | symbol;
		metadata: CronMetadata;
		invoke: (...args: unknown[]) => unknown | Promise<unknown>;
	}): void {
		const methodName = String(context.methodName);
		const jobName = `${context.moduleName}.${context.controllerClass.name}.${methodName}`;

		this.cronScheduler.scheduleCron({
			name: jobName,
			expression: context.metadata.expression,
			options: context.metadata.options,
			run: () => context.invoke({ source: "cron", jobName, at: new Date() }),
		});
	}
}
