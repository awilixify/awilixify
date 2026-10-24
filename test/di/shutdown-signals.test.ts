import { afterEach, describe, expect, it, vi } from "vitest";
import { DIContext } from "../../lib/di/contexts/di-context.js";
import { AsyncDIContext } from "../../lib/di/contexts/di-context-async.js";

const apps: { close(): Promise<void> }[] = [];

afterEach(async () => {
	await Promise.allSettled(apps.splice(0).map((app) => app.close()));
	vi.restoreAllMocks();
});

function getSignalListeners() {
	return {
		SIGINT: process.listeners("SIGINT"),
		SIGTERM: process.listeners("SIGTERM"),
	};
}

function getShutdownHandler(
	signal: "SIGINT" | "SIGTERM",
	original: ReturnType<typeof getSignalListeners>,
) {
	const handler = process
		.listeners(signal)
		.find((listener) => !original[signal].includes(listener));

	if (!handler) throw new Error("Shutdown listener not installed");

	// Node types listeners as returning void, but our shutdown handler returns a promise.
	return handler as (signal: NodeJS.Signals) => Promise<void>;
}

function deferred() {
	let resolve!: () => void;
	const promise = new Promise<void>((done) => {
		resolve = done;
	});
	return { promise, resolve };
}

describe("Shutdown signal handling", () => {
	it("is opt-in, idempotent, and removes listeners on manual close without terminating", async () => {
		const original = getSignalListeners();

		const kill = vi.spyOn(process, "kill").mockReturnValue(true);

		const app = DIContext.create({ name: "App" });
		apps.push(app);

		expect(getSignalListeners()).toEqual(original);

		app.enableShutdownHooks();

		const enabled = getSignalListeners();
		expect(enabled.SIGINT).toHaveLength(original.SIGINT.length + 1);
		expect(enabled.SIGTERM).toHaveLength(original.SIGTERM.length + 1);

		app.enableShutdownHooks();
		expect(getSignalListeners()).toEqual(enabled);

		await app.close();
		expect(getSignalListeners()).toEqual(original);
		expect(kill).not.toHaveBeenCalled();
		app.enableShutdownHooks();
		expect(getSignalListeners()).toEqual(original);
	});

	it.each([
		"SIGINT",
		"SIGTERM",
	] as const)("awaits cleanup before re-sending %s and ignores repeated signals", async (signal) => {
		const original = getSignalListeners();
		const kill = vi.spyOn(process, "kill").mockImplementation(() => {
			expect(getSignalListeners()).toEqual(original);

			return true;
		});

		// Keep cleanup pending so we can inspect shutdown while it is running.
		const release = deferred();
		const cleanup = vi.fn(() => release.promise);

		class Service {
			beforeShutdown = cleanup;
		}
		const app = DIContext.create({
			name: "App",
			providers: { service: { eager: true, useClass: Service } },
		});
		apps.push(app);
		await app.init();
		app.enableShutdownHooks();

		const handler = getShutdownHandler(signal, original);
		const otherSignal = signal === "SIGINT" ? "SIGTERM" : "SIGINT";
		const otherHandler = getShutdownHandler(otherSignal, original);

		// Wait for cleanup to start, but not finish: it is waiting on release.promise.
		const shutdown = handler(signal);
		await vi.waitFor(() => {
			expect(cleanup).toHaveBeenCalledOnce();
		});

		// Another signal must not restart cleanup or terminate the process early.
		await otherHandler(otherSignal);
		expect(cleanup).toHaveBeenCalledTimes(1);
		expect(kill).not.toHaveBeenCalled();

		// Unblock cleanup, then wait for shutdown to finish and re-send the signal.
		release.resolve();
		await shutdown;
		expect(kill).toHaveBeenCalledExactlyOnceWith(process.pid, signal);
		expect(getSignalListeners()).toEqual(original);
	});

	it("logs failed signal shutdown, removes listeners, and exits with code 1", async () => {
		const original = getSignalListeners();
		const kill = vi.spyOn(process, "kill").mockReturnValue(true);
		const exit = vi
			.spyOn(process, "exit")
			.mockImplementation(() => undefined as never);
		const log = vi.spyOn(console, "error").mockImplementation(() => {});
		const failure = new Error("cleanup failed");
		class Service {
			onShutdown() {
				throw failure;
			}
		}
		const app = DIContext.create({
			name: "App",
			providers: { service: { eager: true, useClass: Service } },
		});
		apps.push(app);
		await app.init();
		app.enableShutdownHooks();
		const handler = getShutdownHandler("SIGTERM", original);

		await handler("SIGTERM");

		expect(getSignalListeners()).toEqual(original);
		expect(kill).not.toHaveBeenCalled();
		expect(exit).toHaveBeenCalledExactlyOnceWith(1);
		expect(log).toHaveBeenCalledWith(
			"Application shutdown failed",
			expect.objectContaining({ errors: [failure] }),
		);
	});

	it("removes listeners when manual close fails without terminating", async () => {
		const original = getSignalListeners();
		const kill = vi.spyOn(process, "kill").mockReturnValue(true);
		class Service {
			onShutdown() {
				throw new Error("cleanup failed");
			}
		}
		const app = DIContext.create({
			name: "App",
			providers: { service: { eager: true, useClass: Service } },
		});
		apps.push(app);
		await app.init();
		app.enableShutdownHooks();
		await expect(app.close()).rejects.toBeInstanceOf(AggregateError);
		expect(getSignalListeners()).toEqual(original);
		expect(kill).not.toHaveBeenCalled();
	});

	it("exposes close and signal handling on async contexts", async () => {
		const original = getSignalListeners();
		const app = await AsyncDIContext.create({ name: "App" });
		apps.push(app);
		app.enableShutdownHooks();
		await app.close();
		expect(getSignalListeners()).toEqual(original);
	});
});
