import { createContainer, Lifetime } from "awilix";
import { describe, expect, it, vi } from "vitest";
import { getControllerMethodNames } from "../../lib/devtools/helpers.js";
import { AsyncDIContext } from "../../lib/di/contexts/di-context-async.js";
import { ControllerProcessor } from "../../lib/di/processors/controller-processor.js";
import { InterceptorProcessor } from "../../lib/di/processors/interceptor-processor.js";
import { ProviderDependencySorter } from "../../lib/di/providers/provider-dependency-sorter.js";
import { ProviderResolver } from "../../lib/di/providers/provider-resolver.js";
import { isResultLike } from "../../lib/di/type-guards.js";

describe("Internal coverage", () => {
	it("recognizes Result-like values", () => {
		expect(isResultLike({ ok: true, value: 1 })).toBe(true);
		expect(isResultLike({ ok: false, error: "boom" })).toBe(true);
		expect(isResultLike({ ok: false, value: 1 })).toBe(false);
		expect(isResultLike("nope")).toBe(false);
	});

	it("throws when provider dependency sorting sees unresolved async imports", () => {
		const sorter = new ProviderDependencySorter();

		expect(() =>
			sorter.sortByDependencies({
				name: "AsyncImportModule",
				imports: [
					Promise.resolve({
						name: "ImportedModule",
						exports: ["importedValue"],
					}),
				],
				providers: {
					consumer: {
						inject: ["importedValue"],
						useFactory: (importedValue: unknown) => importedValue,
					},
				},
			} as any),
		).toThrow(/Async module import/);
	});

	it("reuses cached async module trees and pending registrations", async () => {
		const AsyncDIContextCtor = AsyncDIContext as unknown as {
			new (options: unknown): any;
		};

		const module = { name: "SharedModule" };
		const scope = createContainer();
		const moduleTree = {
			name: "SharedModule",
			scope,
			importedScopes: new Map(),
			init: async () => {},
			dispose: async () => {},
		};

		const contextWithTree = new AsyncDIContextCtor({});
		contextWithTree.moduleTreeMap.set(module, moduleTree);

		await expect(
			contextWithTree.registerModuleWithScopeAsync(module, scope, []),
		).resolves.toBe(moduleTree);

		const contextWithPending = new AsyncDIContextCtor({});
		const pendingTree = Promise.resolve(moduleTree);
		contextWithPending.moduleTreePromiseMap.set(module, pendingTree);

		await expect(
			contextWithPending.registerModuleWithScopeAsync(module, scope, []),
		).resolves.toBe(moduleTree);
	});

	it("skips duplicate controller registration when the same module is processed twice", () => {
		class TestController {
			registerRoutes() {}
		}

		const processor = new ControllerProcessor(
			{
				createInterceptedProviderResolver: ({ resolver }: { resolver: any }) =>
					resolver,
			} as any,
			{},
			false,
			{ current: null },
		);
		const scope = createContainer();
		const module = {
			name: "RepeatedModule",
			controllers: [TestController],
		} as any;

		expect(processor.processControllers(module, scope)).toHaveLength(1);
		expect(processor.processControllers(module, scope)).toHaveLength(0);
	});

	it("collects symbol-named controller methods for initializer scanning", () => {
		const METHOD = Symbol("method");

		class SymbolController {
			registerRoutes() {}
			[METHOD]() {}
		}

		const methods = getControllerMethodNames(SymbolController);

		expect(methods).toContain(METHOD);
	});

	it("returns plain properties, reuses wrapped methods, and tolerates sparse interceptor chains", () => {
		const processor = new InterceptorProcessor({}, {}) as any;
		const instance = {
			value: 7,
			getValue() {
				return this.value;
			},
		};

		const proxied = processor.createInterceptedProviderInstance(
			instance,
			instance,
			[],
			"TestModule",
		);

		expect(proxied.value).toBe(7);
		expect(proxied.getValue).toBe(proxied.getValue);
		expect(
			processor.callWithInterceptorChain({
				target: instance,
				methodName: "getValue",
				moduleName: "TestModule",
				args: [],
				metadataByToken: new Map(),
				interceptors: [undefined],
				proceed: () => 7,
			}),
		).toBe(7);
	});

	it("uses request scope resolver for exported non-singleton class providers only when provided", () => {
		class Service {}

		const module = { name: "ProviderModule" } as any;
		const baseScope = createContainer();
		const requestScope = createContainer();
		const requestScopeResolver = vi.fn(() => requestScope);

		const resolverWithRequestScope = new ProviderResolver(
			undefined,
			{},
			{},
			requestScopeResolver,
		);

		resolverWithRequestScope
			.resolveClassProvider({
				provider: {
					useClass: Service,
					lifetime: Lifetime.SCOPED,
				},
				resolutionScope: baseScope,
				module,
				wrapForExport: true,
			})
			.resolve(baseScope);

		expect(requestScopeResolver).toHaveBeenCalledWith(baseScope);

		requestScopeResolver.mockClear();

		resolverWithRequestScope
			.resolveClassProvider({
				provider: {
					useClass: Service,
					lifetime: Lifetime.SINGLETON,
				},
				resolutionScope: baseScope,
				module,
				wrapForExport: true,
			})
			.resolve(baseScope);

		expect(requestScopeResolver).not.toHaveBeenCalled();

		const resolverWithoutRequestScope = new ProviderResolver(undefined, {}, {});

		expect(() =>
			resolverWithoutRequestScope
				.resolveClassProvider({
					provider: {
						useClass: Service,
						lifetime: Lifetime.SCOPED,
					},
					resolutionScope: baseScope,
					module,
					wrapForExport: true,
				})
				.resolve(baseScope),
		).not.toThrow();
	});
});
