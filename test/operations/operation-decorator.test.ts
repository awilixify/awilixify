import { describe, expect, it } from "vitest";
import { resolveDecoratorState } from "../../lib/decorators/decorator-state.js";
import {
	callsOperation,
	OPERATION_CALL_DECORATOR_STATE_TOKEN,
	OPERATION_PUBLISH_DECORATOR_STATE_TOKEN,
	publishesOperation,
} from "../../lib/operations/operation.decorator.js";

describe("operation decorators", () => {
	it("records called operations on provider methods", () => {
		class WarehouseApiClient {
			@callsOperation({
				serviceName: "warehouse",
				operationId: "createReservation",
				transport: "http",
			})
			createReservation() {}
		}

		const state = resolveDecoratorState(
			WarehouseApiClient,
			OPERATION_CALL_DECORATOR_STATE_TOKEN,
		);

		expect(state?.methods.get("createReservation")).toEqual([
			{
				serviceName: "warehouse",
				operationId: "createReservation",
				transport: "http",
			},
		]);
	});

	it("normalizes message contracts used as called operations", () => {
		const message = {
			serviceName: "warehouse",
			type: "warehouse.reserve-inventory.v1",
		};

		class WarehouseMessagingClient {
			@callsOperation(message)
			reserveInventory() {}
		}

		const state = resolveDecoratorState(
			WarehouseMessagingClient,
			OPERATION_CALL_DECORATOR_STATE_TOKEN,
		);

		expect(state?.methods.get("reserveInventory")).toEqual([
			{
				serviceName: "warehouse",
				transport: "messaging",
				type: "warehouse.reserve-inventory.v1",
			},
		]);
	});

	it("records published operations on provider methods", () => {
		class ReservationsService {
			@publishesOperation({
				type: "warehouse.reservation-created.v1",
			})
			createReservation() {}
		}

		const state = resolveDecoratorState(
			ReservationsService,
			OPERATION_PUBLISH_DECORATOR_STATE_TOKEN,
		);

		expect(state?.methods.get("createReservation")).toEqual([
			{
				transport: "messaging",
				type: "warehouse.reservation-created.v1",
			},
		]);
	});
});
