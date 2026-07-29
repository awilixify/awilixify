import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	generateAsyncApiClient,
	generateAsyncApiConsumer,
} from "../../lib/codegen/generate-asyncapi-client.js";

describe("generateAsyncApiClient", () => {
	const outputDirectories: string[] = [];

	afterEach(async () => {
		await Promise.all(
			outputDirectories
				.splice(0)
				.map((directory) => rm(directory, { force: true, recursive: true })),
		);
	});

	it("generates an AMQP publisher from a receive operation", async () => {
		const outputDirectory = await mkdtemp(join(tmpdir(), "asyncapi-codegen-"));
		outputDirectories.push(outputDirectory);
		const modulePath = join(outputDirectory, "warehouse-messaging.module.ts");

		const result = await generateAsyncApiClient({
			asyncApi: {
				channels: {
					ReserveInventory: {
						address: "inventory.reserve.v1",
						bindings: {
							amqp: {
								exchange: {
									durable: true,
									name: "warehouse.commands",
									type: "direct",
								},
							},
						},
						messages: {
							ReserveInventory: {
								name: "warehouse.reserve-inventory.v1",
								payload: {
									properties: {
										orderId: { minLength: 1, type: "string" },
									},
									required: ["orderId"],
									type: "object",
								},
							},
						},
					},
				},
				operations: {
					reserveInventory: {
						action: "receive",
						channel: { $ref: "#/channels/ReserveInventory" },
						messages: [
							{
								$ref: "#/channels/ReserveInventory/messages/ReserveInventory",
							},
						],
					},
				},
			},
			clientClassName: "WarehouseMessagingClient",
			messagesConstName: "WarehouseMessages",
			outputDirectory,
			runtimeImport: "@example/rabbitmq",
			serviceName: "warehouse",
			include: ["reserveInventory"],
			clientFileName: "warehouse-messaging.client.ts",
			messagesFileName: "warehouse.messages.ts",
			module: {
				clientImport: "./generated/warehouse-messaging.client.js",
				clientProviderName: "warehouseMessagingClient",
				messagesImport: "./generated/warehouse.messages.js",
				moduleName: "WarehouseMessagingModule",
				outputPath: modulePath,
			},
		});

		const client = await readFile(result.clientPath, "utf8");
		const messages = await readFile(result.messagesPath, "utf8");
		const module = await readFile(modulePath, "utf8");

		expect(result.operationIds).toEqual(["reserveInventory"]);
		expect(messages).toContain('routingKey: "inventory.reserve.v1"');
		expect(messages).toContain('type: "warehouse.reserve-inventory.v1"');
		expect(messages).not.toContain("operationId:");
		expect(messages).toContain("defineRabbitMessage");
		expect(messages).toContain("export interface ReserveInventoryPayload");
		expect(messages).toContain("orderId: string;");
		expect(messages).toContain("defineRabbitMessage<ReserveInventoryPayload>");
		expect(messages).not.toContain("@sinclair/typebox");
		expect(client).toContain("class WarehouseMessagingClient");
		expect(client).toContain("this.rabbitPublisher.publish(");
		expect(client).toContain(
			"@callsOperation(WarehouseMessages.reserveInventory)",
		);
		expect(module).toContain("RabbitMqModule");
		expect(module).toContain("publisher: WarehouseMessages");
		expect(result.moduleCreated).toBe(true);

		await writeFile(modulePath, "// Customized\n");
		const second = await generateAsyncApiClient({
			asyncApi: {
				channels: {
					ReserveInventory: {
						address: "inventory.reserve.v1",
						bindings: {
							amqp: { exchange: { name: "warehouse.commands" } },
						},
						messages: {
							ReserveInventory: {
								name: "warehouse.reserve-inventory.v1",
								payload: { type: "string" },
							},
						},
					},
				},
				operations: {
					reserveInventory: {
						action: "receive",
						channel: { $ref: "#/channels/ReserveInventory" },
						messages: [
							{
								$ref: "#/channels/ReserveInventory/messages/ReserveInventory",
							},
						],
					},
				},
			},
			clientClassName: "WarehouseMessagingClient",
			messagesConstName: "WarehouseMessages",
			outputDirectory,
			runtimeImport: "@example/rabbitmq",
			serviceName: "warehouse",
			module: {
				clientImport: "./generated/warehouse-messaging.client.js",
				clientProviderName: "warehouseMessagingClient",
				messagesImport: "./generated/warehouse.messages.js",
				moduleName: "WarehouseMessagingModule",
				outputPath: modulePath,
			},
		});

		expect(second.moduleCreated).toBe(false);
		await expect(readFile(modulePath, "utf8")).resolves.toBe("// Customized\n");
	});

	it("generates a publisher for a payload-less receive operation", async () => {
		const outputDirectory = await mkdtemp(join(tmpdir(), "asyncapi-codegen-"));
		outputDirectories.push(outputDirectory);

		const result = await generateAsyncApiClient({
			asyncApi: {
				channels: {
					RefreshInventory: {
						address: "inventory.refresh.v1",
						bindings: {
							amqp: { exchange: { name: "warehouse.commands" } },
						},
						messages: {
							RefreshInventory: {
								name: "warehouse.refresh-inventory.v1",
							},
						},
					},
				},
				operations: {
					refreshInventory: {
						action: "receive",
						channel: { $ref: "#/channels/RefreshInventory" },
						messages: [
							{
								$ref: "#/channels/RefreshInventory/messages/RefreshInventory",
							},
						],
					},
				},
			},
			clientClassName: "WarehouseMessagingClient",
			messagesConstName: "WarehouseMessages",
			outputDirectory,
			runtimeImport: "@example/rabbitmq",
			serviceName: "warehouse",
		});

		const client = await readFile(result.clientPath, "utf8");
		const messages = await readFile(result.messagesPath, "utf8");

		expect(result.operationIds).toEqual(["refreshInventory"]);
		expect(messages).toContain("refreshInventory:");
		expect(messages).not.toContain("RefreshInventoryPayload");
		expect(client).toContain("refreshInventory(): Promise<void>");
		expect(client).toContain(
			"message: this.rabbitPublisher.messages.refreshInventory",
		);
	});

	it("generates consumer contracts from send operations", async () => {
		const outputDirectory = await mkdtemp(join(tmpdir(), "asyncapi-codegen-"));
		outputDirectories.push(outputDirectory);
		const modulePath = join(outputDirectory, "warehouse-events.module.ts");

		const result = await generateAsyncApiConsumer({
			asyncApi: {
				channels: {
					ReservationCreated: {
						address: "reservation.created.v1",
						bindings: {
							amqp: {
								exchange: {
									name: "warehouse.events",
									type: "topic",
								},
							},
						},
						messages: {
							ReservationCreated: {
								name: "warehouse.reservation-created.v1",
								payload: {
									properties: {
										orderId: { type: "string" },
										reservationId: { type: "string" },
									},
									required: ["orderId", "reservationId"],
									type: "object",
								},
							},
						},
					},
				},
				operations: {
					reservationCreated: {
						action: "send",
						channel: { $ref: "#/channels/ReservationCreated" },
						messages: [
							{
								$ref: "#/channels/ReservationCreated/messages/ReservationCreated",
							},
						],
					},
				},
			},
			messagesConstName: "WarehouseEvents",
			outputDirectory,
			runtimeImport: "@example/rabbitmq",
			serviceName: "warehouse",
			module: {
				messagesImport: "./generated/warehouse.events.js",
				moduleName: "WarehouseEventsModule",
				outputPath: modulePath,
			},
		});

		const messages = await readFile(result.messagesPath, "utf8");
		const module = await readFile(modulePath, "utf8");

		expect(result.operationIds).toEqual(["reservationCreated"]);
		expect(messages).toContain("ReservationCreatedPayload");
		expect(messages).toContain('routingKey: "reservation.created.v1"');
		expect(messages).toContain('serviceName: "warehouse"');
		expect(messages).toContain('type: "warehouse.reservation-created.v1"');
		expect(messages).not.toContain("operationId:");
		expect(module).toContain("consumer: Object.values(WarehouseEvents)");
		expect(result.moduleCreated).toBe(true);
	});
});
