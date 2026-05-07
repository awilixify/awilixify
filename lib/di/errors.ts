export class DuplicateControllersInModuleError extends Error {
	constructor(moduleName: string) {
		super(
			`Module "${moduleName}" has duplicate controllers in its controllers array.`,
		);
		this.name = "DuplicateControllersInModuleError";
	}
}

export class ControllerAlreadyRegisteredError extends Error {
	constructor(controllerName: string, moduleName: string) {
		super(
			`Controller "${controllerName}" is already registered in module "${moduleName}". ` +
				`Controllers must be unique across modules. ` +
				`Exclude controllers from one of the module instances.`,
		);
		this.name = "ControllerAlreadyRegisteredError";
	}
}

export class DependencyNotFoundError extends Error {
	constructor(dependencyKey: string, moduleName: string) {
		super(`"${dependencyKey}" does not exist in scope of ${moduleName} module`);
		this.name = "DependencyNotFoundError";
	}
}

export class CircularDependencyError extends Error {
	constructor(moduleName: string, providerKeys: string[]) {
		super(
			`Circular dependency detected in module "${moduleName}" for providers: ${providerKeys.join(", ")}`,
		);
		this.name = "CircularDependencyError";
	}
}

export class DuplicateModuleImportError extends Error {
	constructor(parentModuleName: string, importedModuleName: string) {
		super(
			`Module "${parentModuleName}" has duplicate import of "${importedModuleName}"`,
		);
		this.name = "DuplicateModuleImportError";
	}
}

export class ProviderNameConflictError extends Error {
	constructor(moduleName: string, conflictingKeys: string[]) {
		super(
			`Module "${moduleName}" has provider name conflicts with imported modules: ${conflictingKeys.join(", ")}`,
		);
		this.name = "ProviderNameConflictError";
	}
}

export class CircularModuleDependencyError extends Error {
	constructor(moduleName: string, chain: string[]) {
		super(
			`Circular module dependency detected: ${chain.join(" -> ")} -> ${moduleName}`,
		);
		this.name = "CircularModuleDependencyError";
	}
}

export class GlobalModuleImportsGlobalModuleError extends Error {
	constructor(moduleName: string, importedGlobalModuleName: string) {
		super(
			`Global module "${moduleName}" cannot import global module "${importedGlobalModuleName}". ` +
				`Register both modules in DIContext.globalModules without importing one from another.`,
		);
		this.name = "GlobalModuleImportsGlobalModuleError";
	}
}

export class UnsupportedFrameworkError extends Error {
	constructor() {
		super(
			"Unsupported framework detected. Only Fastify and Express are currently supported for decorator-based routing.",
		);
		this.name = "UnsupportedFrameworkError";
	}
}

export class HandlerMissingStaticKeyError extends Error {
	constructor(handlerName: string) {
		super(
			`Handler class "${handlerName}" must have a static "key" property of type string. ` +
				`Example: static readonly key = "my-handler" as const;`,
		);
		this.name = "HandlerMissingStaticKeyError";
	}
}

export class MiddlewareNameConflictError extends Error {
	constructor(
		moduleName: string,
		middlewareKey: string,
		existingModuleName: string,
		handlerType: "query" | "command",
	) {
		super(
			`Module "${moduleName}" has a ${handlerType} pre-handler named "${middlewareKey}" ` +
				`that conflicts with a pre-handler already registered from module "${existingModuleName}". ` +
				`Pre-handler names must be unique within a module scope.`,
		);
		this.name = "MiddlewareNameConflictError";
	}
}

export class InterceptorNameConflictError extends Error {
	constructor(
		moduleName: string,
		interceptorKey: string,
		existingModuleName: string,
	) {
		super(
			`Module "${moduleName}" has an interceptor named "${interceptorKey}" ` +
				`that conflicts with an interceptor already registered from module "${existingModuleName}". ` +
				`Interceptor names must be unique within a module scope.`,
		);
		this.name = "InterceptorNameConflictError";
	}
}

export class ControllerInitializerConflictError extends Error {
	constructor(moduleName: string) {
		super(
			`Module "${moduleName}" has duplicate controller initializers across imports/local initializers.`,
		);
		this.name = "ControllerInitializerConflictError";
	}
}
