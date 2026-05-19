import { types as utilTypes } from "node:util";
import { Lifetime } from "awilix";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { createDecoratorStateUpdater } from "../../lib/decorators/decorator-state.js";
import { DIContext } from "../../lib/di/contexts/di-context.js";
import * as ERRORS from "../../lib/di/errors.js";
import type { AnyModule } from "../../lib/di/modules/module.types.js";
import type {
	InterceptContext,
	Interceptor,
} from "../../lib/di/providers/provider.types.js";
import { GET } from "../../lib/http/decorators.js";
import {
	createHttpTestModule,
	createMockExpress,
} from "../http/http-test-module.js";

describe("Controller interceptors", () => {
	let interceptorInstances: number;
	let calls: string[];

	beforeEach(() => {
		interceptorInstances = 0;
		calls = [];
	});

	const registerModule = (module: AnyModule) => {
		return DIContext.create(module);
	};

	function createTestInterceptor(name: string) {
		const { token, update } = createDecoratorStateUpdater(name, {
			method: (): { tag?: string } => ({}),
		});

		function decorate(tag: string) {
			return (target: any, context: ClassMethodDecoratorContext) => {
				update(context, {
					method: () => ({ tag }),
				});
				return target;
			};
		}

		class TestInterceptor implements Interceptor<typeof token> {
			token = token;

			constructor() {
				interceptorInstances += 1;
			}

			intercept(context: InterceptContext<typeof token>) {
				calls.push(`${context.methodName.toString()}:${name}`);
				return context.proceed();
			}
		}

		return { decorate, TestInterceptor, token };
	}

	const track = createTestInterceptor("track");
	const audit = createTestInterceptor("audit");

	const TrackingModule = {
		name: "TrackingModule",
		interceptors: { track: track.TestInterceptor },
		interceptorExports: ["track"],
	};

	it("should not instantiate interceptors for providers without decorated methods", () => {
		class PlainProvider {
			getValue() {
				return "plain";
			}
		}

		const app = registerModule({
			name: "AppModule",
			imports: [TrackingModule],
			providers: { plain: PlainProvider },
		});
		const plain = app.scope.resolve<PlainProvider>("plain");

		expect(plain.getValue()).toBe("plain");
		expect(utilTypes.isProxy(plain)).toBe(false);
		expect(interceptorInstances).toBe(0);
	});

	it("should run interceptor only for decorated methods", () => {
		class PlainProvider {
			@track.decorate("tracked")
			decorated() {
				return 42;
			}

			plain() {
				return 7;
			}
		}

		const app = registerModule({
			name: "AppModule",
			imports: [TrackingModule],
			providers: { plain: PlainProvider },
		});
		const plain = app.scope.resolve<PlainProvider>("plain");

		expect(plain.decorated()).toBe(42);
		expect(utilTypes.isProxy(plain)).toBe(true);
		expect(plain.plain()).toBe(7);
		expect(calls).toEqual(["decorated:track"]);
	});

	it("should preserve sync behavior for sync interceptor and return Promise for async interceptor", async () => {
		class SyncInterceptor implements Interceptor<typeof track.token> {
			token = track.token;

			intercept(context: InterceptContext<typeof track.token>) {
				return context.proceed();
			}
		}

		class AsyncInterceptor implements Interceptor<typeof track.token> {
			token = track.token;

			async intercept(context: InterceptContext<typeof track.token>) {
				return context.proceed();
			}
		}

		class Service {
			@track.decorate("value")
			getValue() {
				return 9;
			}
		}

		const sync = registerModule({
			name: "SyncModule",
			providers: { service: Service },
			interceptors: { sync: SyncInterceptor },
		});
		const async = registerModule({
			name: "AsyncModule",
			providers: { service: Service },
			interceptors: { async: AsyncInterceptor },
		});

		const syncService = sync.scope.resolve<any>("service");
		const asyncService = async.scope.resolve<any>("service");

		const syncResult = syncService.getValue();
		expect(syncResult).toBe(9);
		expect(syncResult instanceof Promise).toBe(false);

		const asyncResult = asyncService.getValue();
		expect(asyncResult instanceof Promise).toBe(true);
		expect(await asyncResult).toBe(9);
	});

	it("should distinguish scoped and transient interceptor lifetime inside one controller request", async () => {
		async function collectInterceptorInstanceIds(
			lifetime: "SCOPED" | "TRANSIENT",
		) {
			let nextInterceptorId = 0;
			const interceptorInstanceIds: number[] = [];
			const mockExpress = createMockExpress();

			class CountingInterceptor implements Interceptor<typeof track.token> {
				token = track.token;
				readonly instanceId = ++nextInterceptorId;

				intercept(context: InterceptContext<typeof track.token>) {
					interceptorInstanceIds.push(this.instanceId);
					return context.proceed();
				}
			}

			class ScopedController {
				constructor(private readonly resolveSelf: () => ScopedController) {}

				@GET("/interceptor-lifetime")
				@track.decorate("route")
				handle() {
					const self = this.resolveSelf();
					self.inner();
					self.inner();

					return "ok";
				}

				@track.decorate("inner")
				inner() {
					return "inner";
				}
			}

			const app = DIContext.create(
				{
					name: "AppModule",
					controllers: [
						{
							useClass: ScopedController,
							lifetime: Lifetime.SCOPED,
						},
					],
					interceptors: {
						counting: {
							useClass: CountingInterceptor,
							lifetime,
						},
					},
				},
				{
					globalModules: [createHttpTestModule(mockExpress)],
				},
			);

			await app.init();

			const route = mockExpress.get.mock.calls.find(
				([path]: [string]) => path === "/interceptor-lifetime",
			);
			const handler = route?.at(-1);
			const reply = { headersSent: false, send: vi.fn() };

			await handler({}, reply, vi.fn());

			expect(reply.send).toHaveBeenCalledWith("ok");

			return interceptorInstanceIds;
		}

		expect(await collectInterceptorInstanceIds("SCOPED")).toEqual([1, 1, 1]);
		expect(await collectInterceptorInstanceIds("TRANSIENT")).toEqual([1, 2, 3]);
	});

	it("should run two interceptors on the same provider method", () => {
		class MultiTrackedProvider {
			@track.decorate("tracked")
			@audit.decorate("audited")
			getTracked() {
				return "tracked";
			}
		}

		const MultiTrackingModule = {
			name: "MultiTrackingModule",
			interceptors: {
				audit: audit.TestInterceptor,
				track: track.TestInterceptor,
			},
			interceptorExports: ["track", "audit"],
		};

		const app = registerModule({
			name: "AppModule",
			imports: [MultiTrackingModule],
			providers: { tracked: MultiTrackedProvider },
		});
		const tracked = app.scope.resolve<MultiTrackedProvider>("tracked");

		expect(tracked.getTracked()).toBe("tracked");
		expect(calls).toEqual(["getTracked:track", "getTracked:audit"]);
	});

	it("should skip interceptors whose decorator token has no metadata on the invoked method", () => {
		class TrackedProvider {
			@track.decorate("tracked")
			getTracked() {
				return "tracked";
			}
		}

		const MultiTrackingModule = {
			name: "MultiTrackingModule",
			interceptors: {
				audit: audit.TestInterceptor,
				track: track.TestInterceptor,
			},
			interceptorExports: ["track", "audit"],
		};

		const app = registerModule({
			name: "AppModule",
			imports: [MultiTrackingModule],
			providers: { tracked: TrackedProvider },
		});
		const tracked = app.scope.resolve<TrackedProvider>("tracked");

		expect(tracked.getTracked()).toBe("tracked");
		expect(calls).toEqual(["getTracked:track"]);
	});

	it("should throw when imported interceptor keys conflict in the same module scope", () => {
		class TrackedProvider {
			@track.decorate("tracked")
			getTracked() {
				return "tracked";
			}
		}

		const ImportedA = {
			name: "ImportedA",
			interceptors: { shared: track.TestInterceptor },
			interceptorExports: ["shared"],
		};
		const ImportedB = {
			name: "ImportedB",
			interceptors: { shared: track.TestInterceptor },
			interceptorExports: ["shared"],
		};

		expect(() =>
			registerModule({
				name: "AppDupImports",
				providers: { tracked: TrackedProvider },
				imports: [ImportedA, ImportedB],
			}),
		).toThrow(ERRORS.FeatureNameConflictError);

		expect(() =>
			registerModule({
				name: "AppImportAndLocal",
				providers: { tracked: TrackedProvider },
				imports: [ImportedA],
				interceptors: { shared: track.TestInterceptor },
			}),
		).toThrow(ERRORS.FeatureNameConflictError);
	});

	it("should no-op safely when decorator metadata is missing or methodName is null", () => {
		const { update } = createDecoratorStateUpdater("missing-metadata", {
			method: () => 0,
		});
		const target = function test() {};

		const context = {
			kind: "method",
			name: "method",
			metadata: undefined,
		} as any;

		update(context, { method: () => 1 });

		expect(target).toBe(target);
	});
});
