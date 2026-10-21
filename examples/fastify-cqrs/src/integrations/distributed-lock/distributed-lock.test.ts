import {
	createModule,
	DIContext,
	type ModuleDef,
	overrideModule,
} from "awilixify";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
	DistributedLock,
	type LockOptions,
} from "./distributed-lock.decorator.js";
import { type Deps, DistributedLockModule } from "./distributed-lock.module.js";

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (reason: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});

	return { promise, resolve, reject };
}

function createRedisMock() {
	let owner: string | undefined;
	let expires = 0;

	const set = vi.fn(
		async (_key: string, token: string, _px: string, ttl: number) => {
			if (owner && expires > Date.now()) return null;

			owner = token;
			expires = Date.now() + ttl;

			return "OK";
		},
	);

	const evalScript = vi.fn(
		async (
			_script: string,
			_count: number,
			_key: string,
			token: string,
			ttl?: number,
		) => {
			if (owner !== token || expires <= Date.now()) return 0;

			if (ttl !== undefined) expires = Date.now() + ttl;
			else owner = undefined;

			return 1;
		},
	);
	const redis = {
		set,
		eval: evalScript,
	} as unknown as Deps["redis"];

	return { redis, set, evalScript };
}

async function setup(options: LockOptions) {
	vi.useFakeTimers();
	const logError = vi.spyOn(console, "error").mockImplementation(() => {});
	const { redis, set, evalScript } = createRedisMock();

	class ScheduledJob {
		@DistributedLock({
			...options,
			key: (id: string, _work: () => unknown) => `job:${id}`,
		})
		execute(_id: string, work: () => unknown) {
			return work();
		}
	}

	type TestDef = ModuleDef<{
		imports: [typeof DistributedLockModule];
		providers: { scheduledJob: ScheduledJob };
	}>;
	const testModule = createModule<TestDef>({
		name: "DistributedLockTest",
		imports: [DistributedLockModule],
		providers: { scheduledJob: ScheduledJob },
	});

	const app = DIContext.create(testModule, {
		moduleOverrides: [
			overrideModule(DistributedLockModule, {
				providers: { redis },
			}),
		],
	});

	await app.init({ excludeInitializers: true });

	const job = app.scope.resolve<ScheduledJob>("scheduledJob");

	const run = (work: () => unknown) => job.execute("42", work);

	return { run, set, evalScript, logError };
}

afterEach(() => {
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("distributed lock renewal", () => {
	it.each([
		0,
		-1,
		NaN,
		Infinity,
		1.5,
		30_000,
		40_000,
		2_147_483_648,
	])("rejects invalid renewal interval %s before acquisition", async (renewalIntervalMs) => {
		const { run, set } = await setup({ leaseMs: 30_000, renewalIntervalMs });

		await expect(run(vi.fn())).rejects.toThrow("renewalIntervalMs");
		expect(set).not.toHaveBeenCalled();
	});

	it("does not renew unless configured", async () => {
		const { run, set, evalScript } = await setup({ leaseMs: 30_000 });

		const work = deferred<void>();
		const result = run(() => work.promise);

		await vi.advanceTimersByTimeAsync(30_001);
		expect(set).toHaveBeenCalledOnce();
		expect(evalScript).not.toHaveBeenCalled();
		work.resolve();
		await result;
	});

	it("keeps a long-running job's lease and skips competitors", async () => {
		const { run, set, evalScript } = await setup({
			leaseMs: 30_000,
			renewalIntervalMs: 10_000,
		});
		const work = deferred<string>();
		const competitor = vi.fn();
		const result = run(() => work.promise);

		await vi.advanceTimersByTimeAsync(40_000);

		expect(evalScript).toHaveBeenCalledTimes(4);
		expect(evalScript).toHaveBeenCalledWith(
			expect.stringContaining("redis.call('PEXPIRE', KEYS[1], ARGV[2])"),
			1,
			JSON.stringify(["distributed-lock", "job:42"]),
			set.mock.calls[0]?.[1],
			30_000,
		);

		expect(competitor).not.toHaveBeenCalled();
		work.resolve("done");
		await expect(result).resolves.toBe("done");

		expect(vi.getTimerCount()).toBe(0); // checks that no pending timers left
		await expect(run(() => "next")).resolves.toBe("next");
	});

	it.each([
		false,
		true,
	])("releases the lock and cancels renewal when work fails, async=%s", async (asyncFailure) => {
		const { run, evalScript } = await setup({
			leaseMs: 30_000,
			renewalIntervalMs: 10_000,
		});

		const error = new Error("work failed");

		await expect(
			run(() => {
				if (asyncFailure) return Promise.reject(error);
				throw error;
			}),
		).rejects.toBe(error);

		expect(vi.getTimerCount()).toBe(0);
		expect(evalScript).toHaveBeenCalledOnce();
		expect(evalScript.mock.calls[0]?.[0]).toContain(
			"redis.call('DEL', KEYS[1])",
		);
		await expect(run(() => "next")).resolves.toBe("next");
	});

	it.each([
		"lost",
		"redis error",
	])("logs renewal failure without changing the job result: %s", async (failure) => {
		const { run, evalScript, logError } = await setup({
			leaseMs: 30_000,
			renewalIntervalMs: 10_000,
		});

		const redisError = new Error("Redis down");
		const work = deferred<string>();
		const result = run(() => work.promise);

		if (failure === "lost") evalScript.mockResolvedValueOnce(0);
		else evalScript.mockRejectedValueOnce(redisError);

		await vi.advanceTimersByTimeAsync(10_000);
		expect(vi.getTimerCount()).toBe(0);
		await vi.advanceTimersByTimeAsync(10_000);
		expect(evalScript).toHaveBeenCalledOnce();
		expect(logError).toHaveBeenCalledOnce();

		expect(logError).toHaveBeenCalledWith(
			...(failure === "lost"
				? ["[DistributedLock] lease lost: job:42"]
				: ["[DistributedLock] lease renewal failed: job:42", redisError]),
		);

		work.resolve("done");
		await expect(result).resolves.toBe("done");
	});

	it("preserves a job failure after renewal fails", async () => {
		const { run, evalScript, logError } = await setup({
			leaseMs: 30_000,
			renewalIntervalMs: 10_000,
		});

		evalScript.mockRejectedValueOnce(new Error("Redis down"));
		const work = deferred<void>();
		const error = new Error("job failed");
		const assertion = expect(run(() => work.promise)).rejects.toBe(error);

		await vi.advanceTimersByTimeAsync(10_000);

		expect(logError).toHaveBeenCalledOnce();
		work.reject(error);
		await assertion;
		expect(vi.getTimerCount()).toBe(0);
	});

	it("waits for an in-flight renewal before releasing, without overlapping renewals", async () => {
		const { run, evalScript } = await setup({
			leaseMs: 30_000,
			renewalIntervalMs: 10_000,
		});

		const renewal = deferred<0 | 1>();
		const work = deferred<void>();

		evalScript.mockImplementationOnce(() => renewal.promise);
		const result = run(() => work.promise);

		await vi.advanceTimersByTimeAsync(20_000);

		// two renews should happen. But first one is long so it blocks next
		expect(evalScript).toHaveBeenCalledOnce();
		work.resolve();

		await vi.advanceTimersByTimeAsync(0);

		expect(evalScript).toHaveBeenCalledOnce(); // still wait for first renew
		renewal.resolve(1);

		await result;

		expect(evalScript).toHaveBeenCalledTimes(2);
		expect(evalScript.mock.calls[1]?.[0]).toContain(
			"redis.call('DEL', KEYS[1])",
		);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("prevents a paused worker from renewing or deleting a lock acquired by another worker", async () => {
		const { run, set, evalScript } = await setup({
			leaseMs: 30_000,
			renewalIntervalMs: 10_000,
		});

		const first = deferred<void>();
		const firstResult = run(() => first.promise);

		await Promise.resolve();
		// Simulate an event-loop pause: time advances without running heartbeats.
		vi.setSystemTime(Date.now() + 31_000);

		const replacement = deferred<string>();
		const replacementResult = run(() => replacement.promise);

		await vi.advanceTimersByTimeAsync(10_000);

		const firstToken = set.mock.calls[0]?.[1];
		const replacementToken = set.mock.calls[1]?.[1];

		const firstRenewal = evalScript.mock.calls.findIndex(
			(call) => call[3] === firstToken && call[4] !== undefined,
		);
		const replacementRenewal = evalScript.mock.calls.findIndex(
			(call) => call[3] === replacementToken && call[4] !== undefined,
		);

		await expect(evalScript.mock.results[firstRenewal]?.value).resolves.toBe(0);
		await expect(
			evalScript.mock.results[replacementRenewal]?.value,
		).resolves.toBe(1);

		first.resolve();

		await expect(firstResult).resolves.toBeUndefined();
		const competitor = vi.fn();
		await expect(run(competitor)).resolves.toBeUndefined();
		expect(competitor).not.toHaveBeenCalled(); // lock is still hold by replacement
		replacement.resolve("done");
		await expect(replacementResult).resolves.toBe("done");
	});
});

describe("distributed lock maxHoldMs", () => {
	it("requires renewalIntervalMs when maxHoldMs is supplied", async () => {
		// @ts-expect-error maxHoldMs requires renewalIntervalMs, including for typed callers.
		const { run, set } = await setup({ leaseMs: 30_000, maxHoldMs: 45_000 });
		await expect(run(vi.fn())).rejects.toThrow(
			"maxHoldMs requires renewalIntervalMs",
		);
		expect(set).not.toHaveBeenCalled();
	});

	it.each([
		0,
		-1,
		NaN,
		Infinity,
		1.5,
		Number.MAX_SAFE_INTEGER + 1,
	])("rejects invalid maxHoldMs %s before acquisition", async (maxHoldMs) => {
		const { run, set } = await setup({
			leaseMs: 30_000,
			renewalIntervalMs: 10_000,
			maxHoldMs,
		});
		await expect(run(vi.fn())).rejects.toThrow("maxHoldMs");
		expect(set).not.toHaveBeenCalled();
	});

	it("rejects maxHoldMs shorter than leaseMs before acquisition", async () => {
		const { run, set } = await setup({
			leaseMs: 30_000,
			renewalIntervalMs: 10_000,
			maxHoldMs: 29_999,
		});
		await expect(run(vi.fn())).rejects.toThrow("maxHoldMs");
		expect(set).not.toHaveBeenCalled();
	});

	it("shortens renewals near the deadline and lets another worker acquire while the first still runs", async () => {
		const { run, evalScript, logError } = await setup({
			leaseMs: 30_000,
			renewalIntervalMs: 10_000,
			maxHoldMs: 45_000,
		});

		const work = deferred<string>();
		const result = run(() => work.promise);

		await vi.advanceTimersByTimeAsync(40_000);

		expect(evalScript.mock.calls.map((call) => call[4])).toEqual([
			30_000, 25_000, 15_000, 5_000,
		]);
		expect(vi.getTimerCount()).toBe(0);

		const competitor = vi.fn();

		await expect(run(competitor)).resolves.toBeUndefined();
		expect(competitor).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(5_000);

		await expect(run(() => "replacement finished")).resolves.toBe(
			"replacement finished",
		);
		work.resolve("first finished");
		await expect(result).resolves.toBe("first finished");
		expect(logError).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("allows maxHoldMs equal to leaseMs", async () => {
		const { run, set, evalScript } = await setup({
			leaseMs: 30_000,
			renewalIntervalMs: 10_000,
			maxHoldMs: 30_000,
		});
		const work = deferred<void>();
		const result = run(() => work.promise);

		await vi.advanceTimersByTimeAsync(30_000);

		expect(set.mock.calls[0]?.[3]).toBe(30_000);
		expect(evalScript.mock.calls.map((call) => call[4])).toEqual([
			20_000, 10_000,
		]);
		expect(vi.getTimerCount()).toBe(0);
		work.resolve();
		await result;
	});

	it("stops renewal if a delayed timer resumes after the deadline", async () => {
		const { run, evalScript, logError } = await setup({
			leaseMs: 30_000,
			renewalIntervalMs: 10_000,
			maxHoldMs: 45_000,
		});

		const work = deferred<void>();
		const result = run(() => work.promise);

		await vi.advanceTimersByTimeAsync(0);

		// Simulate a pause where the deadline passes before the timer can run.
		const resumedAt = performance.now() + 45_000;
		vi.setSystemTime(Date.now() + 45_000);
		vi.spyOn(performance, "now").mockReturnValue(resumedAt);

		await vi.advanceTimersByTimeAsync(10_000);

		expect(evalScript).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
		expect(logError).not.toHaveBeenCalled();
		work.resolve();
		await result;
	});
});

describe("distributed lock acquisition polling", () => {
	it("tries once by default and skips occupied locks", async () => {
		const { run, set, evalScript } = await setup({ leaseMs: 30_000 });

		set.mockResolvedValue(null);

		const work = vi.fn();
		await expect(run(work)).resolves.toBeUndefined();
		expect(set).toHaveBeenCalledOnce();
		expect(work).not.toHaveBeenCalled();
		expect(evalScript).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("counts the first attempt and polls only at the configured interval", async () => {
		const { run, set, evalScript } = await setup({
			leaseMs: 30_000,
			pollIntervalMs: 1_000,
			maxPollAttempts: 3,
		});

		set.mockResolvedValue(null);

		const work = vi.fn();
		const result = run(work);

		await vi.advanceTimersByTimeAsync(999);

		expect(set).toHaveBeenCalledOnce();

		await vi.advanceTimersByTimeAsync(1);

		expect(set).toHaveBeenCalledTimes(2);

		await vi.advanceTimersByTimeAsync(1_000);

		await expect(result).resolves.toBeUndefined();
		expect(set).toHaveBeenCalledTimes(3);
		expect(work).not.toHaveBeenCalled();
		expect(evalScript).not.toHaveBeenCalled();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("lets a waiting invocation run after the owner finishes", async () => {
		const { run, set } = await setup({
			leaseMs: 30_000,
			pollIntervalMs: 1_000,
			maxPollAttempts: 5,
		});

		const work = deferred<void>();
		const first = run(() => work.promise);

		await vi.advanceTimersByTimeAsync(0);

		const nextWork = vi.fn(() => "next");
		const next = run(nextWork);

		await vi.advanceTimersByTimeAsync(2_500);

		expect(nextWork).not.toHaveBeenCalled();

		work.resolve();
		await first;
		await vi.advanceTimersByTimeAsync(500);

		await expect(next).resolves.toBe("next");
		expect(nextWork).toHaveBeenCalledOnce();
		expect(set).toHaveBeenCalledTimes(5);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("keeps polling with Infinity until the owner's lease expires", async () => {
		const { run, set } = await setup({
			leaseMs: 12_000,
			pollIntervalMs: 1_000,
			maxPollAttempts: Infinity,
		});

		const work = deferred<void>();
		const first = run(() => work.promise);

		await vi.advanceTimersByTimeAsync(0);

		const nextWork = vi.fn(() => "next");
		const next = run(nextWork);

		await vi.advanceTimersByTimeAsync(11_999);

		expect(nextWork).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(1);

		await expect(next).resolves.toBe("next");
		expect(set).toHaveBeenCalledTimes(14);
		work.resolve();
		await first;
		expect(vi.getTimerCount()).toBe(0);
	});

	it("starts maxHoldMs when the lock is acquired, not when polling begins", async () => {
		const { run, set, evalScript } = await setup({
			leaseMs: 30_000,
			renewalIntervalMs: 10_000,
			maxHoldMs: 45_000,
			pollIntervalMs: 10_000,
			maxPollAttempts: Infinity,
		});

		set
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(null)
			.mockResolvedValueOnce(null);

		const work = deferred<void>();
		const result = run(() => work.promise);

		await vi.advanceTimersByTimeAsync(30_000);

		// The fourth attempt acquires with an initial 30s TTL via SET, not EVAL.
		expect(set).toHaveBeenCalledTimes(4);
		expect(set).toHaveBeenNthCalledWith(
			4,
			JSON.stringify(["distributed-lock", "job:42"]),
			expect.any(String),
			"PX",
			30_000,
			"NX",
		);
		expect(evalScript).not.toHaveBeenCalled();

		await vi.advanceTimersByTimeAsync(40_000);

		// Renewal TTLs only; the initial SET lease is not included.
		expect(evalScript.mock.calls.map((call) => call[4])).toEqual([
			30_000, 25_000, 15_000, 5_000,
		]);
		expect(vi.getTimerCount()).toBe(0);
		work.resolve();
		await result;
	});

	it("stops polling and throws when Redis acquisition fails", async () => {
		const { run, set } = await setup({
			leaseMs: 30_000,
			maxPollAttempts: Infinity,
		});

		const error = new Error("Redis down");
		set.mockRejectedValue(error);
		const work = vi.fn();
		await expect(run(work)).rejects.toBe(error);
		expect(work).not.toHaveBeenCalled();
		expect(set).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);

		await vi.advanceTimersByTimeAsync(5_000);
		expect(set).toHaveBeenCalledOnce();
	});

	it.each([
		0,
		-1,
		NaN,
		Infinity,
		1.5,
		2_147_483_648,
	])("rejects invalid pollIntervalMs %s before acquisition", async (pollIntervalMs) => {
		const { run, set } = await setup({ leaseMs: 30_000, pollIntervalMs });
		await expect(run(vi.fn())).rejects.toThrow("pollIntervalMs");
		expect(set).not.toHaveBeenCalled();
	});

	it.each([
		0,
		-1,
		NaN,
		-Infinity,
		1.5,
		Number.MAX_SAFE_INTEGER + 1,
	])("rejects invalid maxPollAttempts %s before acquisition", async (maxPollAttempts) => {
		const { run, set } = await setup({ leaseMs: 30_000, maxPollAttempts });
		await expect(run(vi.fn())).rejects.toThrow("maxPollAttempts");
		expect(set).not.toHaveBeenCalled();
	});
});
