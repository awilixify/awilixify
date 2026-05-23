import * as Awilix from "awilix";
import { createElement } from "react";

import type { RegisteredModuleScope } from "../di/contexts/container-context-base.js";
import type { InternalModuleLike as M } from "../di/modules/runtime-module.types.js";
import * as ERRORS from "./errors.js";
import type { ReactComponent } from "./react-module.types.js";

export class ReactComponentProcessor {
	processComponents(m: M, scope: Awilix.AwilixContainer): void {
		if (!m.components) return;

		const componentKeys = Object.keys(m.components);
		const conflicts = componentKeys.filter((key) => scope.registrations[key]);

		if (conflicts.length > 0) {
			throw new ERRORS.ComponentNameConflictError(m.name, conflicts);
		}

		for (const [key, component] of Object.entries(m.components)) {
			scope.register({
				[key]: Awilix.asValue(this.wrapComponent(key, component, scope)),
			});
		}
	}

	registerExportedComponents(
		scope: Awilix.AwilixContainer,
		importedModulesWithScope: RegisteredModuleScope[],
	): void {
		for (const { module, moduleScope } of importedModulesWithScope) {
			for (const key of module.componentExports || []) {
				if (!module.components?.[key]) {
					throw new ERRORS.InvalidComponentExportError(module.name, key);
				}

				if (scope.registrations[key]) {
					throw new ERRORS.ComponentNameConflictError(module.name, [key]);
				}

				scope.register({
					[key]: Awilix.asFunction(() => moduleScope.scope.resolve(key), {
						lifetime: Awilix.Lifetime.TRANSIENT,
						isLeakSafe: true,
					}),
				});
			}
		}
	}

	getExportedComponentKeys(module: M): string[] {
		return module.componentExports ? [...module.componentExports] : [];
	}

	private wrapComponent(
		key: string,
		component: ReactComponent,
		scope: Awilix.AwilixContainer,
	): ReactComponent {
		return (props: Record<string, unknown> = {}) => {
			if (Object.hasOwn(props, "deps")) {
				throw new ERRORS.ComponentDepsOverrideError(key);
			}

			return createElement(component, {
				...props,
				deps: this.createDepsProxy(scope),
			});
		};
	}

	private createDepsProxy(
		scope: Awilix.AwilixContainer,
	): Record<string, unknown> {
		return new Proxy(
			{},
			{
				get: (_target, prop) => {
					if (typeof prop !== "string") return undefined;

					if (!scope.registrations[prop]) return undefined;

					return scope.resolve(prop);
				},
			},
		);
	}
}
