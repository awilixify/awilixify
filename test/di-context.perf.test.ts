import { describe, expect, it } from "vitest";
import { DIContext } from "../lib/di/contexts/di-context.js";
import { createModule } from "../lib/di/modules/module-factories.js";

describe("DIContext Performance", () => {
	const measure = (name: string, fn: () => void) => {
		const start = performance.now();
		fn();
		const duration = performance.now() - start;
		console.log(`${name}: ${duration.toFixed(2)}ms`);
		return duration;
	};

	it("should handle realistic heavy app: 250 modules, ~5000 providers, 3 levels deep", () => {
		// 10 modules × 15 providers = 150 providers
		const infrastructureModules = [...Array(10)].map((_, i) => {
			const name = `Infra-${i}`;
			const providers = [...Array(15)].reduce((acc, _, j) => {
				acc[`${name}-provider-${j}`] = class InfraProvider {
					infraId = i;
					serviceId = j;
				};
				return acc;
			}, {});

			const exports = [...Array(8)].map((_, j) => `${name}-provider-${j}`);

			return createModule<any>({
				name,
				providers,
				exports,
			});
		});

		// 40 modules × 21 providers = 840 providers
		// Each imports 3-4 infrastructure modules
		const domainModules = [...Array(40)].map((_, i) => {
			const name = `Domain-${i}`;
			const providers = [...Array(21)].reduce((acc, _, j) => {
				acc[`${name}-provider-${j}`] = class DomainProvider {
					domainId = i;
					serviceId = j;
				};
				return acc;
			}, {});

			const exports = [...Array(10)].map((_, j) => `${name}-provider-${j}`);

			// Each domain imports 3-4 infrastructure modules
			const importCount = 3 + (i % 2);
			const imports = [...Array(importCount)].map((_, j) => {
				const infraIndex = (i + j) % 10;
				return infrastructureModules[infraIndex];
			});

			return createModule<any>({
				name,
				providers,
				exports,
				imports,
			});
		});

		// Layer 3a: Base Feature modules (150 modules × 20 providers = 3000 providers)
		// Each imports 10 domain + 10 infrastructure
		const baseFeatureModules = [...Array(150)].map((_, i) => {
			const name = `BaseFeature-${i}`;
			const providers = [...Array(20)].reduce((acc, _, j) => {
				acc[`${name}-provider-${j}`] = class BaseFeatureProvider {
					featureId = i;
					serviceId = j;
				};
				return acc;
			}, {});

			const exports = [...Array(8)].map((_, j) => `${name}-provider-${j}`);

			const domainImports = [...Array(10)].map((_, j) => {
				const domainIndex = (i + j * 3) % 40;
				return domainModules[domainIndex];
			});

			return createModule<any>({
				name,
				providers,
				exports,
				imports: [...domainImports, ...infrastructureModules],
			});
		});

		// Layer 3b: Advanced Feature modules (50 modules × 20 providers = 1000 providers)
		// Each imports 5 base features + 10 domain + 10 infrastructure
		const advancedFeatureModules = [...Array(50)].map((_, i) => {
			const name = `AdvFeature-${i}`;
			const providers = [...Array(20)].reduce((acc, _, j) => {
				acc[`${name}-provider-${j}`] = class AdvFeatureProvider {
					featureId = i;
					serviceId = j;
				};
				return acc;
			}, {});

			// Import 5 base feature modules
			const baseFeatureImports = [...Array(5)].map((_, j) => {
				const baseFeatureIndex = (i * 5 + j) % 150;
				return baseFeatureModules[baseFeatureIndex];
			});

			// Import 10 domain modules
			const domainImports = [...Array(10)].map((_, j) => {
				const domainIndex = (i + j * 3) % 40;
				return domainModules[domainIndex];
			});

			return createModule<any>({
				name,
				providers,
				imports: [
					...baseFeatureImports,
					...domainImports,
					...infrastructureModules,
				],
			});
		});

		const duration = measure(
			"Register 250 modules (10 infra + 40 domain + 200 feature), 3 levels deep",
			() => {
				DIContext.create(
					{
						name: "Root",
						imports: [...baseFeatureModules, ...advancedFeatureModules],
					},
					{
						framework: {},
					},
				);
			},
		);

		// 10 infra × 15 = 150 providers
		// 40 domain × 21 = 840 providers
		// 200 feature × 20 = 4,000 providers
		// Total: 4,990 unique providers, ~250 unique modules
		const totalProviders = 10 * 15 + 40 * 21 + 200 * 20;
		expect(duration).toBeLessThan(10000);
		console.log(
			`  ⚡ ${(duration / totalProviders).toFixed(3)}ms per provider`,
		);
		console.log(`  📦 ${(duration / 250).toFixed(2)}ms per unique module`);
	}, 10000);
});
