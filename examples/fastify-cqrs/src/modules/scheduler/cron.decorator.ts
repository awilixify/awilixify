import {
	createControllerInitializerDecorator,
	createControllerMetadataToken,
} from "awilix-modular";

export type CronMetadata = {
	expression: string;
	options?: Record<string, unknown>;
};

export const CRON_METADATA_TOKEN = createControllerMetadataToken<CronMetadata>(
	"cron",
);

const applyCronMetadata = createControllerInitializerDecorator(CRON_METADATA_TOKEN);

export function cron(expression: string, options?: Record<string, unknown>) {
	return applyCronMetadata({ expression, options });
}
