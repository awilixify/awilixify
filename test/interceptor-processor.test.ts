import { describe, expect, it } from "vitest";

import { DIContext } from "../lib/di/di-context.js";
import * as ERRORS from "../lib/di/errors.js";
import { createStaticModule } from "../lib/di/module-factories.js";
import type { ModuleDef } from "../lib/di/module-def.types.js";
import type {
	Interceptor,
	InterceptContext,
} from "../lib/di/interceptor.types.js";
import { createInterceptDecorator } from "../lib/decorators/interceptor-decorator-factory.js";
import { setInterceptorMetadata } from "../lib/decorators/interceptor-state.js";

const mark = createInterceptDecorator("mark");

describe("Interceptors", () => {
	it("should run interceptor only for decorated methods", () => {
		const calls: Array<{ method: string | symbol; meta: unknown }> = [];

		class TrackInterceptor implements Interceptor {
			intercept(context: InterceptContext) {
				calls.push({ method: context.methodName, meta: context.meta.mark });
				return context.proceed();
			}
		}

		class Service {
			@mark({ tag: "decorated" })
			decorated() {
				return 42;
			}

			plain() {
				return 7;
			}
		}

		type AppDef = ModuleDef<{
			providers: { service: Service };
			interceptors: { track: TrackInterceptor };
		}>;

		const AppModule = createStaticModule<AppDef>({
			name: "AppModule",
			providers: { service: Service },
			interceptors: { track: TrackInterceptor },
		});

		const root = DIContext.create(AppModule, { framework: {} });
		const service = root.scope.resolve<any>("service");

		expect(service.decorated()).toBe(42);
		expect(service.plain()).toBe(7);
		expect(calls).toEqual([
			{ method: "decorated", meta: { tag: "decorated" } },
		]);
	});

	it("should preserve sync behavior for sync interceptor and return Promise for async interceptor", async () => {
		class SyncInterceptor implements Interceptor {
			intercept(context: InterceptContext) {
				return context.proceed();
			}
		}

		class AsyncInterceptor implements Interceptor {
			async intercept(context: InterceptContext) {
				return context.proceed();
			}
		}

		class Service {
			@mark(true)
			getValue() {
				return 9;
			}
		}

		type SyncDef = ModuleDef<{
			providers: { service: Service };
			interceptors: { sync: SyncInterceptor };
		}>;
		type AsyncDef = ModuleDef<{
			providers: { service: Service };
			interceptors: { async: AsyncInterceptor };
		}>;

		const SyncModule = createStaticModule<SyncDef>({
			name: "SyncModule",
			providers: { service: Service },
			interceptors: { sync: SyncInterceptor },
		});
		const AsyncModule = createStaticModule<AsyncDef>({
			name: "AsyncModule",
			providers: { service: Service },
			interceptors: { async: AsyncInterceptor },
		});

		const syncService = DIContext.create(SyncModule, {
			framework: {},
		}).scope.resolve<any>("service");
		const asyncService = DIContext.create(AsyncModule, {
			framework: {},
		}).scope.resolve<any>("service");

		const syncResult = syncService.getValue();
		expect(syncResult).toBe(9);
		expect(syncResult instanceof Promise).toBe(false);

		const asyncResult = asyncService.getValue();
		expect(asyncResult instanceof Promise).toBe(true);
		expect(await asyncResult).toBe(9);
	});

	it("should support imported interceptor exports and throw on interceptor key conflicts", () => {
		const calls: string[] = [];

		class ImportedInterceptor implements Interceptor {
			intercept(context: InterceptContext) {
				calls.push(String(context.methodName));
				return context.proceed();
			}
		}

		class Service {
			@mark(true)
			getValue() {
				return 5;
			}
		}

		type ImportedDef = ModuleDef<{
			interceptors: { shared: ImportedInterceptor };
			exportInterceptorKeys: ["shared"];
		}>;
		const ImportedA = createStaticModule<ImportedDef>({
			name: "ImportedA",
			interceptors: { shared: ImportedInterceptor },
			interceptorExports: ["shared"],
		});
		const ImportedB = createStaticModule<ImportedDef>({
			name: "ImportedB",
			interceptors: { shared: ImportedInterceptor },
			interceptorExports: ["shared"],
		});

		type AppOkDef = ModuleDef<{
			providers: { service: Service };
			imports: [typeof ImportedA];
		}>;
		const AppOk = createStaticModule<AppOkDef>({
			name: "AppOk",
			providers: { service: Service },
			imports: [ImportedA],
		});

		const appRoot = DIContext.create(AppOk, { framework: {} });
		const service = appRoot.scope.resolve<any>("service");
		expect(service.getValue()).toBe(5);
		expect(calls).toEqual(["getValue"]);

		type AppDupImportsDef = ModuleDef<{
			providers: { service: Service };
			imports: [typeof ImportedA, typeof ImportedB];
		}>;
		const AppDupImports = createStaticModule<AppDupImportsDef>({
			name: "AppDupImports",
			providers: { service: Service },
			imports: [ImportedA, ImportedB],
		});
		expect(() => DIContext.create(AppDupImports, { framework: {} })).toThrow(
			ERRORS.InterceptorNameConflictError,
		);

		type AppImportAndLocalDef = ModuleDef<{
			providers: { service: Service };
			imports: [typeof ImportedA];
			interceptors: { shared: ImportedInterceptor };
		}>;
		const AppImportAndLocal = createStaticModule<AppImportAndLocalDef>({
			name: "AppImportAndLocal",
			providers: { service: Service },
			imports: [ImportedA],
			interceptors: { shared: ImportedInterceptor },
		});
		expect(() =>
			DIContext.create(AppImportAndLocal, { framework: {} }),
		).toThrow(ERRORS.InterceptorNameConflictError);
	});

	it("should no-op safely when decorator metadata is missing or methodName is null", () => {
		const dec = createInterceptDecorator("x");
		const target = function test() {};

		const result = dec(1)(target, {
			kind: "method",
			name: "m",
			metadata: undefined,
		} as any);
		expect(result).toBe(target);

		const state = { methods: new Map<any, any>() } as any;
		const next = setInterceptorMetadata(state, null, "x", 1);
		expect(next).toBe(state);
		expect(state.methods.size).toBe(0);

		const stateWithMethod = setInterceptorMetadata(
			{ methods: new Map() } as any,
			"m",
			"a",
			1,
		);
		const updatedSameMethod = setInterceptorMetadata(
			stateWithMethod as any,
			"m",
			"b",
			2,
		);
		expect(updatedSameMethod.methods.get("m")?.meta).toEqual({ a: 1, b: 2 });
	});
});
