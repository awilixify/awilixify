import type { BuildResolverOptions, Constructor } from "awilix";

export type ConstructorController = Constructor<Controller>;

export type ClassController = {
	useClass: ConstructorController | Constructor<any>;
} & BuildResolverOptions<any>;

export type AnyController =
	| ConstructorController
	| ClassController
	| Constructor<any>;

export interface Controller {
	registerRoutes: () => void;
}
