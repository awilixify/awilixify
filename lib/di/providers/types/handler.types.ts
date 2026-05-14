import type { BuildResolverOptions, Constructor } from "awilix";
import type { AnyContract } from "lib/mediator/contract.types.js";
import type { Handler } from "lib/mediator/handler.types.js";

export interface ConstructorHandler<C extends AnyContract = AnyContract> {
	new (...args: any[]): Handler<C>;
}

export type ClassHandler<H extends Constructor<any> = Constructor<any>> = {
	useClass: H;
} & BuildResolverOptions<any>;
