import * as ERRORS from "../errors.js";
import type { AnyModuleOverride } from "../modules/module-overrides.js";
import type { InternalModuleLike } from "../modules/runtime-module.types.js";

export type OverrideOptions = {
	moduleOverrides?: readonly AnyModuleOverride[];
};

export const FeatureKind = {
	Providers: "providers",
	QueryPreHandlers: "queryPreHandlers",
	CommandPreHandlers: "commandPreHandlers",
	Interceptors: "interceptors",
	Initializers: "initializers",
} as const;

type FeatureKind = (typeof FeatureKind)[keyof typeof FeatureKind];

const FEATURE_KINDS = Object.values(FeatureKind);

export class OverridesProcessor<M extends InternalModuleLike> {
	private readonly effectiveModuleMap = new WeakMap<M, M>();
	private readonly appliedModuleOverrides = new WeakSet<M>();

	constructor(private readonly options: OverrideOptions) {}

	applyModuleOverrides(module: M): M {
		const moduleOverride = this.options.moduleOverrides?.find(
			(override) => override.module === module,
		);

		if (!moduleOverride) {
			this.effectiveModuleMap.set(module, module);

			return module;
		}

		this.ensureModuleOverrideKeysExist(module, moduleOverride);
		this.appliedModuleOverrides.add(module);

		const remappedFeatures = FEATURE_KINDS.reduce<Partial<M>>(
			(acc, featureKind) => {
				Object.assign(
					acc,
					this.remapFeatureOverrides(module, moduleOverride, featureKind),
				);

				return acc;
			},
			{},
		);

		const effectiveModule = {
			...module,
			...remappedFeatures,
		};
		this.effectiveModuleMap.set(module, effectiveModule);

		return effectiveModule;
	}

	getModuleWithOverrides(module: M): M {
		return this.effectiveModuleMap.get(module) ?? module;
	}

	ensureAllModuleOverridesApplied(): void {
		for (const override of this.options.moduleOverrides ?? []) {
			if (!this.appliedModuleOverrides.has(override.module as M)) {
				throw new ERRORS.ModuleOverrideTargetNotFoundError(
					override.module.name,
				);
			}
		}
	}

	private ensureModuleOverrideKeysExist(
		module: M,
		moduleOverride: AnyModuleOverride,
	): void {
		for (const featureKind of FEATURE_KINDS) {
			this.ensureFeatureOverrideKeysExist(
				module,
				featureKind,
				moduleOverride.overrides[featureKind],
			);
		}
	}

	private remapFeatureOverrides<K extends FeatureKind>(
		module: M,
		moduleOverride: AnyModuleOverride,
		featureKind: K,
	): Partial<M> {
		return {
			[featureKind]: {
				...module[featureKind],
				...moduleOverride.overrides[featureKind],
			},
		} as Partial<M>;
	}

	private ensureFeatureOverrideKeysExist(
		module: M,
		featureKind: FeatureKind,
		overrides: Record<string, unknown> | undefined,
	): void {
		if (!overrides) return;

		const featureKeys = new Set(Object.keys(module[featureKind] || {}));

		for (const key of Object.keys(overrides)) {
			if (!featureKeys.has(key)) {
				throw new ERRORS.ModuleFeatureOverrideNotFoundError(
					module.name,
					featureKind,
					key,
				);
			}
		}
	}
}
