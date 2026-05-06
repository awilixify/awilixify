import { Lifetime } from "awilix";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DIContext } from "../lib/di/di-context.js";
import type { AnyModule } from "../lib/di/module.types.js";
import { GET } from "../lib/decorators/http-decorators.js";

describe("Request scope context (AsyncLocalStorage)", () => {
	const createMockExpress = () => {
		const app: any = () => {};
		app.get = vi.fn();
		app.post = vi.fn();
		app.put = vi.fn();
		app.delete = vi.fn();
		app.patch = vi.fn();
		app.options = vi.fn();
		app.head = vi.fn();
		app.use = vi.fn();
		app.set = vi.fn();

		return app;
	};

	let mockExpress: ReturnType<typeof createMockExpress>;

	beforeEach(() => {
		mockExpress = createMockExpress();
	});

	it("should reuse the same scope between controller and handler within one request", async () => {
		class SharedScopedState {
			readonly instanceId = Math.random();
		}

		class GetScopeIdHandler {
			static readonly key = "get-scope-id";

			constructor(private readonly deps: any) {}

			async executor() {
				return this.deps.sharedScopedState.instanceId;
			}
		}

		class ScopeController {
			constructor(private readonly deps: any) {}

			@GET("/scope-test")
			async getScopeIds() {
				await Promise.resolve();
				const controllerId = this.deps.sharedScopedState.instanceId;
				const handlerId = await this.deps.queryMediator.execute(
					"get-scope-id",
					{},
				);

				return { controllerId, handlerId };
			}
		}

		DIContext.create(
			{
				name: "ScopeModule",
				providers: {
					app: mockExpress,
					sharedScopedState: {
						useClass: SharedScopedState,
						lifetime: Lifetime.SCOPED,
					},
				},
				controllers: [
					{
						useClass: ScopeController,
						lifetime: Lifetime.SCOPED,
					},
				],
				queryHandlers: [
					{
						useClass: GetScopeIdHandler,
						lifetime: Lifetime.SCOPED,
					},
				],
			},
			{
				framework: mockExpress,
				containerOptions: {
					injectionMode: "PROXY",
				},
			},
		);

		const getRouteRegistration = mockExpress.get.mock.calls.find(
			([path]: [string]) => path === "/scope-test",
		);

		const handler = getRouteRegistration.at(-1);

		const firstReply = {
			headersSent: false,
			send: vi.fn(),
		};
		await handler({}, firstReply, vi.fn());

		const secondReply = {
			headersSent: false,
			send: vi.fn(),
		};
		await handler({}, secondReply, vi.fn());

		const firstPayload = firstReply.send.mock.calls[0][0];
		const secondPayload = secondReply.send.mock.calls[0][0];

		expect(firstPayload.controllerId).toBe(firstPayload.handlerId);
		expect(secondPayload.controllerId).toBe(secondPayload.handlerId);
		expect(firstPayload.controllerId).not.toBe(secondPayload.controllerId);
	});

	it("should use one imported request scope for multiple exports from the same module", async () => {
		class SharedRequestMarker {
			readonly instanceId = Math.random();
		}

		class ExportedServiceA {
			readonly markerId: number;

			constructor(private readonly deps: any) {
				this.markerId = this.deps.sharedRequestMarker.instanceId;
			}
		}

		class ExportedServiceB {
			readonly markerId: number;

			constructor(private readonly deps: any) {
				this.markerId = this.deps.sharedRequestMarker.instanceId;
			}
		}

		class MultiExportScopeController {
			constructor(private readonly deps: any) {}

			@GET("/multi-export-scope-test")
			async getScopeIds() {
				await Promise.resolve();
				return {
					exportAMarkerId: this.deps.exportedServiceA.markerId,
					exportBMarkerId: this.deps.exportedServiceB.markerId,
				};
			}
		}

		const sharedModule: AnyModule = {
			name: "SharedModuleWithTwoExports",
			providers: {
				sharedRequestMarker: {
					useClass: SharedRequestMarker,
					lifetime: Lifetime.SCOPED,
				},
			},
			exports: {
				exportedServiceA: {
					useClass: ExportedServiceA,
					lifetime: Lifetime.SCOPED,
				},
				exportedServiceB: {
					useClass: ExportedServiceB,
					lifetime: Lifetime.SCOPED,
				},
			},
		};

		DIContext.create(
			{
				name: "AppModuleTwoExports",
				imports: [sharedModule],
				providers: {
					app: mockExpress,
				},
				controllers: [
					{
						useClass: MultiExportScopeController,
						lifetime: Lifetime.SCOPED,
					},
				],
			},
			{
				framework: mockExpress,
				containerOptions: {
					injectionMode: "PROXY",
				},
			},
		);

		const getRouteRegistration = mockExpress.get.mock.calls.find(
			([path]: [string]) => path === "/multi-export-scope-test",
		);

		const handler = getRouteRegistration.at(-1);

		const firstReply = {
			headersSent: false,
			send: vi.fn(),
		};
		await handler({}, firstReply, vi.fn());

		const secondReply = {
			headersSent: false,
			send: vi.fn(),
		};
		await handler({}, secondReply, vi.fn());

		const firstPayload = firstReply.send.mock.calls[0][0];
		const secondPayload = secondReply.send.mock.calls[0][0];

		expect(firstPayload.exportAMarkerId).toBe(firstPayload.exportBMarkerId);
		expect(secondPayload.exportAMarkerId).toBe(secondPayload.exportBMarkerId);
		expect(firstPayload.exportAMarkerId).not.toBe(
			secondPayload.exportAMarkerId,
		);
	});
});
