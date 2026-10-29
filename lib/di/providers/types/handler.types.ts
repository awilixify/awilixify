import type { BuildResolverOptions, Constructor } from "awilix";

export type ClassHandler<H extends Constructor<any> = Constructor<any>> = {
	useClass: H;
} & BuildResolverOptions<any>;
