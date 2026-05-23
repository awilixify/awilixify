export class ComponentNameConflictError extends Error {
	constructor(moduleName: string, conflictingKeys: string[]) {
		super(
			`Module "${moduleName}" has component name conflicts with providers or imported features: ${conflictingKeys.join(", ")}`,
		);
		this.name = "ComponentNameConflictError";
	}
}

export class InvalidComponentExportError extends Error {
	constructor(moduleName: string, componentKey: string) {
		super(
			`Module "${moduleName}" exports component "${componentKey}", but that component is not declared by the module.`,
		);
		this.name = "InvalidComponentExportError";
	}
}

export class ComponentDepsOverrideError extends Error {
	constructor(componentKey: string) {
		super(
			`Component "${componentKey}" received a "deps" prop. React component dependencies are injected by ReactDIContext and cannot be overridden from JSX.`,
		);
		this.name = "ComponentDepsOverrideError";
	}
}

export class ScopedProviderLifetimeError extends Error {
	constructor(moduleName: string, providerKey: string) {
		super(
			`Provider "${providerKey}" in React module "${moduleName}" uses SCOPED lifetime. ReactDIContext supports SINGLETON and TRANSIENT providers only.`,
		);
		this.name = "ScopedProviderLifetimeError";
	}
}
