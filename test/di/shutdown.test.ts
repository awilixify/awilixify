import { Lifetime } from "awilix";
import { describe, expect, it, vi } from "vitest";
import type { BeforeShutdown, OnShutdown } from "../../index.js";
import { DIContext } from "../../lib/di/contexts/di-context.js";
import { AsyncDIContext } from "../../lib/di/contexts/di-context-async.js";
import { ShutdownHookRequiresSingletonLifetimeError } from "../../lib/di/errors.js";
import { ShutdownHook } from "../../lib/di/lifecycle-hooks.js";

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

describe("Application shutdown", () => {
	for (const lifetime of [Lifetime.TRANSIENT, Lifetime.SCOPED]) {
		for (const hook of Object.values(ShutdownHook)) {
			it(`rejects ${lifetime} classes with ${hook} during create without constructing them`, () => {
				const construct = vi.fn();
				class Service {
					constructor() {
						construct();
					}
					[hook]() {}
				}
				expect(() =>
					DIContext.create({
						name: "App",
						providers: { service: { useClass: Service, lifetime } },
					}),
				).toThrow(ShutdownHookRequiresSingletonLifetimeError);
				expect(construct).not.toHaveBeenCalled();
			});

			it(`rejects ${lifetime} classes with ${hook} during async create`, async () => {
				class Service {
					[hook]() {}
				}
				await expect(
					AsyncDIContext.create({
						name: "App",
						providers: { service: { useClass: Service, lifetime } },
					}),
				).rejects.toBeInstanceOf(ShutdownHookRequiresSingletonLifetimeError);
			});

			it(`does not validate ${lifetime} factory results with ${hook} at resolution`, async () => {
				const shutdown = vi.fn();
				const app = DIContext.create({
					name: "App",
					providers: {
						service: { useFactory: () => ({ [hook]: shutdown }), lifetime },
					},
				});
				await app.init();
				expect(() => app.scope.resolve("service")).not.toThrow();
				await app.close();
				expect(shutdown).not.toHaveBeenCalled();
			});
		}

		it(`does not validate ${lifetime} class-field hooks at resolution`, async () => {
			const shutdown = vi.fn();
			class Service {
				beforeShutdown = shutdown;
			}
			const app = DIContext.create({
				name: "App",
				providers: { service: { useClass: Service, lifetime } },
			});
			await app.init();
			expect(() => app.scope.resolve("service")).not.toThrow();
			await app.close();
			expect(shutdown).not.toHaveBeenCalled();
		});

		it(`validates inherited ${lifetime} options and inherited prototype hooks during create`, () => {
			class Base {
				onShutdown() {}
			}
			class Service extends Base {}
			expect(() =>
				DIContext.create({
					name: "App",
					providerOptions: { lifetime },
					providers: { service: Service },
				}),
			).toThrow(ShutdownHookRequiresSingletonLifetimeError);
		});
	}

	it("validates imported providers during context creation", () => {
		const init = vi.fn();
		class Startup {
			onInit = init;
		}
		class Invalid {
			onShutdown() {}
		}
		expect(() =>
			DIContext.create({
				name: "App",
				providers: { startup: { eager: true, useClass: Startup } },
				imports: [
					{
						name: "Imported",
						providers: {
							invalid: { useClass: Invalid, lifetime: Lifetime.SCOPED },
						},
					},
				],
			}),
		).toThrow('Provider "invalid" in module "Imported"');
		expect(init).not.toHaveBeenCalled();
	});

	it("awaits concurrent hooks across modules before cleanup and internal disposal", async () => {
		const release = deferred();
		const started = deferred();
		const calls: string[] = [];
		const cleanupStarted = deferred();
		const releaseCleanup = deferred();

		class Worker implements BeforeShutdown, OnShutdown {
			async beforeShutdown() {
				calls.push("worker:before");
				started.resolve();
				await release.promise;
				calls.push("worker:drained");
			}

			async onShutdown() {
				calls.push("worker:on");
				cleanupStarted.resolve();
				await releaseCleanup.promise;
			}
		}

		class Http {
			beforeShutdown() {
				calls.push("http:before");
			}

			onShutdown() {
				calls.push("http:on");
			}
		}

		const app = DIContext.create({
			name: "App",
			imports: [
				{
					name: "Workers",
					providers: {
						worker: {
							eager: true,
							useClass: Worker,
							dispose: () => {
								calls.push("worker:dispose");
							},
						},
					},
				},
			],
			providers: {
				http: {
					eager: true,
					useClass: Http,
					dispose: () => {
						calls.push("http:dispose");
					},
				},
			},
		});
		await app.init();

		const shutdown = app.close();
		expect(app.close()).toBe(shutdown);
		await started.promise;
		expect(calls).toContain("http:before");
		expect(calls).not.toContain("http:on");
		expect(calls).not.toContain("worker:dispose");

		release.resolve();
		await cleanupStarted.promise;
		expect(calls).not.toContain("http:dispose");
		expect(calls).not.toContain("worker:dispose");
		releaseCleanup.resolve();
		await shutdown;

		expect(calls.indexOf("http:on")).toBeGreaterThan(
			calls.indexOf("worker:drained"),
		);
		expect(calls.indexOf("worker:on")).toBeGreaterThan(
			calls.indexOf("worker:drained"),
		);
		for (const disposal of ["http:dispose", "worker:dispose"]) {
			expect(calls.indexOf(disposal)).toBeGreaterThan(calls.indexOf("http:on"));
			expect(calls.indexOf(disposal)).toBeGreaterThan(
				calls.indexOf("worker:on"),
			);
		}
		await app.close();
		expect(calls.filter((call) => call === "worker:before")).toHaveLength(1);
	});

	it("does not instantiate unused providers during shutdown", async () => {
		const construct = vi.fn();
		const before = vi.fn();
		class Lazy {
			constructor() {
				construct();
			}
			beforeShutdown = before;
		}
		const app = DIContext.create({
			name: "App",
			providers: { lazy: Lazy },
		});
		await app.close();
		expect(construct).not.toHaveBeenCalled();
		expect(before).not.toHaveBeenCalled();
	});

	it("includes non-eager dependencies resolved in imported modules", async () => {
		const before = vi.fn();
		const on = vi.fn();
		class Database {
			beforeShutdown = before;
			onShutdown = on;
		}
		class Worker {
			constructor(readonly database: Database) {}
		}
		const app = DIContext.create({
			name: "App",
			imports: [
				{
					name: "Database",
					providers: { database: Database },
					exports: ["database"],
				},
			],
			providers: { worker: { eager: true, useClass: Worker } },
		});
		await app.init();
		await app.close();
		expect(before).toHaveBeenCalledTimes(1);
		expect(on).toHaveBeenCalledTimes(1);
	});

	it("awaits all hooks and attempts remaining cleanup when hooks fail", async () => {
		const release = deferred();
		const started = deferred();
		const failure = new Error("drain failed");
		const cleanupFailure = new Error("cleanup failed");
		const disposed = vi.fn();
		const on = vi.fn(() => {
			throw cleanupFailure;
		});

		class Broken {
			beforeShutdown() {
				throw failure;
			}
			onShutdown = on;
		}
		class Slow {
			async beforeShutdown() {
				started.resolve();
				await release.promise;
			}
		}
		const app = DIContext.create({
			name: "App",
			providers: {
				broken: { eager: true, useClass: Broken, dispose: disposed },
				slow: { eager: true, useClass: Slow },
			},
		});
		await app.init();

		const shutdown = app.close();

		const rejection = expect(shutdown).rejects.toMatchObject({
			errors: [failure, cleanupFailure],
		});
		await started.promise;
		expect(on).not.toHaveBeenCalled();
		expect(disposed).not.toHaveBeenCalled();
		release.resolve();
		await rejection;
		expect(disposed).toHaveBeenCalledTimes(1);
	});
});
