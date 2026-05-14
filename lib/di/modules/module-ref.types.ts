export type ForwardRef<T = any> = {
	__forward_ref__: true;
	resolve: () => T | Promise<T>;
};

declare const moduleRefMarker: unique symbol;

export type ModuleRef<T> = {
	[moduleRefMarker]: true;
	exports: T extends { exports: infer E } ? E : never;
};

export type AnyModuleRef = ModuleRef<any>;
