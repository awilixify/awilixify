import {
	createModule,
	DIContext,
	type ModuleDef,
	overrideModule,
} from "awilixify";
import { AsyncTask, SimpleIntervalJob, ToadScheduler } from "toad-scheduler";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type CronDefinition, CronTask, cron } from "./cron.decorator.js";
import { ScheduleModule } from "./scheduler.module.js";

function deferred() {
	let resolve!: () => void;
	let reject!: (error: Error) => void;
	const promise = new Promise<void>((done, fail) => {
		resolve = done;
		reject = fail;
	});

	return { promise, resolve, reject };
}

const schedulers: ToadScheduler[] = [];

async function setup(definition: CronDefinition, work: () => unknown) {
	class TestCronTask extends CronTask {
		static definition = definition;
	}

	class JobsController {
		@cron(TestCronTask)
		execute() {
			return work();
		}
	}

	class Resource {
		onShutdown = vi.fn();
	}

	const schedulerModule = ScheduleModule([TestCronTask]);
	const toadScheduler = new ToadScheduler();
	schedulers.push(toadScheduler);
	type TestDef = ModuleDef<{
		imports: [typeof schedulerModule];
		providers: { resource: Resource };
	}>;
	const testModule = createModule<TestDef>({
		name: "SchedulerTest",
		imports: [schedulerModule],
		controllers: [JobsController],
		providers: { resource: Resource },
	});
	const app = DIContext.create(testModule, {
		moduleOverrides: [
			overrideModule(schedulerModule, { providers: { toadScheduler } }),
		],
	});
	await app.init();
	const resource = app.scope.resolve<Resource>("resource");

	return { app, toadScheduler, resource };
}

beforeEach(() => {
	vi.useFakeTimers();
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	for (const scheduler of schedulers.splice(0)) scheduler.stop();
	vi.useRealTimers();
	vi.restoreAllMocks();
});

describe("cron graceful shutdown", () => {
	it("removes scheduled jobs and ignores stale callbacks after shutdown", async () => {
		const work = vi.fn();
		const { app, toadScheduler } = await setup({ seconds: 1 }, work);
		const job = toadScheduler.getAllJobs()[0];

		expect(job).toBeDefined();

		await app.close();
		await vi.advanceTimersByTimeAsync(5_000);
		await (job as SimpleIntervalJob).executeAsync();

		expect(work).not.toHaveBeenCalled();
		expect(toadScheduler.getAllJobs()).toEqual([]);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("waits for every running execution before shutting down resources", async () => {
		const first = deferred();
		const second = deferred();
		const work = vi
			.fn()
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise);

		const { app, resource } = await setup(
			{ seconds: 1, preventOverrun: false },
			work,
		);

		await vi.advanceTimersByTimeAsync(2_000);

		expect(work).toHaveBeenCalledTimes(2);

		let closed = false;
		const shutdown = app.close().then(() => {
			closed = true;
		});

		await vi.advanceTimersByTimeAsync(5_000);

		expect(work).toHaveBeenCalledTimes(2);
		expect(resource.onShutdown).not.toHaveBeenCalled();

		first.resolve();

		await vi.advanceTimersByTimeAsync(0);
		expect(closed).toBe(false);
		expect(resource.onShutdown).not.toHaveBeenCalled();

		second.resolve();

		await shutdown;
		expect(resource.onShutdown).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("tracks jobs that run immediately during initialization", async () => {
		const work = deferred();
		const execute = vi.fn(() => work.promise);

		const { app, resource } = await setup(
			{ seconds: 1, runImmediately: true },
			execute,
		);
		expect(execute).toHaveBeenCalledOnce();

		const shutdown = app.close();
		await vi.advanceTimersByTimeAsync(0);
		expect(resource.onShutdown).not.toHaveBeenCalled();
		work.resolve();
		await shutdown;
		expect(resource.onShutdown).toHaveBeenCalledOnce();
	});

	it.each([
		false,
		true,
	])("logs failed jobs without blocking shutdown, async=%s", async (asyncFailure) => {
		const error = new Error("job failed");
		const work = vi.fn(() => {
			if (asyncFailure) return Promise.reject(error);
			throw error;
		});
		const { app, resource } = await setup({ seconds: 1 }, work);

		await vi.advanceTimersByTimeAsync(1_000);

		expect(console.error).toHaveBeenCalledWith(
			"[Scheduler] job failed: TestCronTask",
			error,
		);

		await app.close();
		expect(resource.onShutdown).toHaveBeenCalledOnce();
		expect(vi.getTimerCount()).toBe(0);
	});

	it("continues draining other executions when one fails during shutdown", async () => {
		const first = deferred();
		const second = deferred();
		const work = vi
			.fn()
			.mockReturnValueOnce(first.promise)
			.mockReturnValueOnce(second.promise);

		const { app, resource } = await setup(
			{ seconds: 1, preventOverrun: false },
			work,
		);

		await vi.advanceTimersByTimeAsync(2_000);

		const shutdown = app.close();
		first.reject(new Error("job failed"));
		await vi.advanceTimersByTimeAsync(0);
		expect(resource.onShutdown).not.toHaveBeenCalled();

		second.resolve();
		await shutdown;
		expect(resource.onShutdown).toHaveBeenCalledOnce();
	});

	it("does not stop jobs belonging to another scheduler sharing the same engine", async () => {
		const work = vi.fn();
		const otherWork = vi.fn(async () => {});

		const { app, toadScheduler } = await setup({ seconds: 1 }, work);

		toadScheduler.addSimpleIntervalJob(
			new SimpleIntervalJob({ seconds: 1 }, new AsyncTask("other", otherWork), {
				id: "other",
			}),
		);

		await app.close();
		await vi.advanceTimersByTimeAsync(1_000);

		expect(work).not.toHaveBeenCalled();
		expect(otherWork).toHaveBeenCalledOnce();
		expect(toadScheduler.getAllJobs().map((job) => job.id)).toEqual(["other"]);
	});
});
