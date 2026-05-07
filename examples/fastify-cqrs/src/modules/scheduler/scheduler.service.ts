import nodeCron from "node-cron";

export type CronScheduleDefinition = {
	name: string;
	expression: string;
	run: () => unknown | Promise<unknown>;
	options?: Record<string, unknown>;
};

export class SchedulerService {
	scheduleCron(definition: CronScheduleDefinition): void {
		if (!nodeCron.validate(definition.expression)) {
			throw new Error(
				`Invalid cron expression for \"${definition.name}\": ${definition.expression}`,
			);
		}

		nodeCron.schedule(
			definition.expression,
			() => {
				void Promise.resolve(definition.run());
			},
			definition.options,
		);
	}
}
