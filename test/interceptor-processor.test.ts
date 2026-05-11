import { describe, expect, it } from "vitest";
import { createDecoratorStateUpdater } from "../lib/decorators/decorator-state.js";
import { DIContext } from "../lib/di/di-context.js";
import * as ERRORS from "../lib/di/errors.js";
import type { ModuleDef } from "../lib/di/module-def.types.js";
import { createStaticModule } from "../lib/di/module-factories.js";
import type {
	InterceptContext,
	Interceptor,
} from "../lib/di/provider.types.js";

const { token: MARK_TOKEN, update: mark } = createDecoratorStateUpdater(
	"mark",
	{ method: (): { tag?: string } => ({}) },
);

function markWith(updater: (prev: { tag?: string }) => { tag?: string }) {
	return (target: any, context: ClassMethodDecoratorContext) => {
		mark(context, { method: updater });
		return target;
	};
}

describe("Interceptors", () => {
	it("should run interceptor only for decorated methods", () => {
		const calls: Array<{ method: string | symbol; meta: unknown }> = [];

		class TrackInterceptor implements Interceptor<typeof MARK_TOKEN> {
			token = MARK_TOKEN;

			intercept(context: InterceptContext<typeof MARK_TOKEN>) {
				calls.push({ method: context.methodName, meta: context.metadata });
				return context.proceed();
			}
		}

		class Service {
			@markWith(() => ({ tag: "decorated" }))
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

		const root = DIContext.create(AppModule, {});
		const service = root.scope.resolve<any>("service");

		expect(service.decorated()).toBe(42);
		expect(service.plain()).toBe(7);
		expect(calls).toEqual([
			{ method: "decorated", meta: { tag: "decorated" } },
		]);
	});

	it("should preserve sync behavior for sync interceptor and return Promise for async interceptor", async () => {
		class SyncInterceptor implements Interceptor<typeof MARK_TOKEN> {
			token = MARK_TOKEN;

			intercept(context: InterceptContext<typeof MARK_TOKEN>) {
				return context.proceed();
			}
		}

		class AsyncInterceptor implements Interceptor<typeof MARK_TOKEN> {
			token = MARK_TOKEN;

			async intercept(context: InterceptContext<typeof MARK_TOKEN>) {
				return context.proceed();
			}
		}

		class Service {
			@markWith(() => true as any)
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

		const syncService = DIContext.create(SyncModule, {}).scope.resolve<any>(
			"service",
		);
		const asyncService = DIContext.create(AsyncModule, {}).scope.resolve<any>(
			"service",
		);

		const syncResult = syncService.getValue();
		expect(syncResult).toBe(9);
		expect(syncResult instanceof Promise).toBe(false);

		const asyncResult = asyncService.getValue();
		expect(asyncResult instanceof Promise).toBe(true);
		expect(await asyncResult).toBe(9);
	});

	it("should support imported interceptor exports and throw on interceptor key conflicts", () => {
		const calls: string[] = [];

		class ImportedInterceptor implements Interceptor<typeof MARK_TOKEN> {
			token = MARK_TOKEN;

			intercept(context: InterceptContext<typeof MARK_TOKEN>) {
				calls.push(String(context.methodName));
				return context.proceed();
			}
		}

		class Service {
			@markWith(() => true as any)
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

		const appRoot = DIContext.create(AppOk, {});
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
		expect(() => DIContext.create(AppDupImports, {})).toThrow(
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
		expect(() => DIContext.create(AppImportAndLocal, {})).toThrow(
			ERRORS.InterceptorNameConflictError,
		);
	});

	it("should no-op safely when decorator metadata is missing or methodName is null", () => {
		const { update: dec } = createDecoratorStateUpdater("x", {
			method: () => 0,
		});
		const target = function test() {};

		const context = {
			kind: "method",
			name: "m",
			metadata: undefined,
		} as any;
		dec(context, { method: () => 1 });
		const result = target;
		expect(result).toBe(target);
	});
});
