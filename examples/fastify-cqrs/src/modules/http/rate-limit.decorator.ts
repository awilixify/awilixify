import type { FastifyContextConfig } from "fastify";
import { createDecoratorStateUpdater } from "awilixify";

type RateLimitConfig = FastifyContextConfig["rateLimit"];

type FastifyRouteConfigMethodState = {
	rateLimit?: RateLimitConfig;
};

const { update, token } = createDecoratorStateUpdater(
	"fastify-route-config-state",
	{
		method: (): FastifyRouteConfigMethodState => ({
			rateLimit: undefined,
		}),
	},
);

export const FASTIFY_ROUTE_CONFIG_TOKEN = token;

export function rateLimit(rateLimitConfig: NonNullable<RateLimitConfig>) {
	return (target: any, context: ClassMethodDecoratorContext) => {
		update(context, {
			method: () => ({
				rateLimit: rateLimitConfig,
			}),
		});

		return target;
	};
}
