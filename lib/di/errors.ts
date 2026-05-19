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

export class HandlerMissingStaticKeyError extends Error {
	constructor(handlerName: string) {
		super(
			`Handler class "${handlerName}" must have a static "key" property of type string. ` +
				`Example: static readonly key = "my-handler" as const;`,
		);
		this.name = "HandlerMissingStaticKeyError";
	}
}

export class FeatureNameConflictError extends Error {
	constructor(
		moduleName: string,
		featureName: string,
		featureKey: string,
		existingModuleName: string,
	) {
		super(
			`Module "${moduleName}" has a ${featureName} named "${featureKey}" ` +
				`that conflicts with a ${featureName} already registered from module "${existingModuleName}". ` +
				`${featureName} names must be unique within a module scope.`,
		);
		this.name = "FeatureNameConflictError";
	}
}

export class InvalidProviderDefinitionError extends Error {
	constructor(moduleName: string, providerKey: string) {
		super(
			`Module "${moduleName}" has invalid provider definition for key "${providerKey}". ` +
				`Provider value is undefined or unsupported.`,
		);
		this.name = "InvalidProviderDefinitionError";
	}
}

export class AsyncFactoryRequiresAsyncCreateError extends Error {
	constructor(moduleName: string, providerKey: string) {
		super(
			`Provider "${providerKey}" in module "${moduleName}" uses async useFactory. ` +
				`Use AsyncDIContext to bootstrap modules with async factory providers.`,
		);
		this.name = "AsyncFactoryRequiresAsyncCreateError";
	}
}

export class AsyncEagerFactoryRequiresInitError extends Error {
	constructor(moduleName: string, providerKey: string) {
		super(
			`Provider "${providerKey}" in module "${moduleName}" uses async useFactory with eager initialization. ` +
				`Call app.init() before resolving this provider.`,
		);
		this.name = "AsyncEagerFactoryRequiresInitError";
	}
}

export class AsyncFactoryRequiresSingletonLifetimeError extends Error {
	constructor(moduleName: string, providerKey: string) {
		super(
			`Provider "${providerKey}" in module "${moduleName}" uses async useFactory with a non-singleton lifetime. ` +
				`Async factory providers are resolved during AsyncDIContext bootstrap, so they must use SINGLETON lifetime.`,
		);
		this.name = "AsyncFactoryRequiresSingletonLifetimeError";
	}
}

export class EagerProviderRequiresSingletonLifetimeError extends Error {
	constructor(moduleName: string, providerKey: string) {
		super(
			`Provider "${providerKey}" in module "${moduleName}" uses eager initialization with a non-singleton lifetime. ` +
				`Eager providers must use SINGLETON lifetime.`,
		);
		this.name = "EagerProviderRequiresSingletonLifetimeError";
	}
}

export class EagerProviderInitDependencyNotFoundError extends Error {
	constructor(moduleName: string, providerKey: string, dependencyKey: string) {
		super(
			`Provider "${providerKey}" in module "${moduleName}" declares initAfter dependency "${dependencyKey}", ` +
				`but that dependency is not an eager provider in the current application lifecycle.`,
		);
		this.name = "EagerProviderInitDependencyNotFoundError";
	}
}

export class CircularProviderInitDependencyError extends Error {
	constructor(providerKeys: string[]) {
		super(
			`Circular eager provider init dependency detected: ${providerKeys.join(", ")}`,
		);
		this.name = "CircularProviderInitDependencyError";
	}
}

export class AsyncModuleRequiresAsyncCreateError extends Error {
	constructor(moduleName: string) {
		super(
			`Module "${moduleName}" imports an async module. ` +
				`Use AsyncDIContext to bootstrap modules with async imports.`,
		);
		this.name = "AsyncModuleRequiresAsyncCreateError";
	}
}

export class DuplicateInitializerTokenError extends Error {
	constructor(
		moduleName: string,
		initializerName: string,
		existingModuleName: string,
	) {
		super(
			`Initializer "${initializerName}" from module "${moduleName}" has a token conflict with an initializer already registered from module "${existingModuleName}". ` +
				`Initializer tokens must be unique within a module scope.`,
		);
		this.name = "DuplicateInitializerTokenError";
	}
}

export class MultipleInvokeInitializersPerMethodError extends Error {
	constructor(
		moduleName: string,
		controllerName: string,
		methodName: string,
		initializerNames: string[],
	) {
		super(
			`Controller method "${controllerName}.${methodName}" in module "${moduleName}" has multiple initializers that receive invoke: ${initializerNames.join(", ")}. ` +
				`Only one invoke-enabled initializer is allowed per method. ` +
				`Metadata-only initializers should set usesInvoke = false.`,
		);
		this.name = "MultipleInvokeInitializersPerMethodError";
	}
}
