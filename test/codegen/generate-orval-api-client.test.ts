import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { generateOrvalApiClient } from "../../lib/codegen/generate-orval-api-client.js";

describe("generateOrvalApiClient", () => {
	const outputDirectories: string[] = [];

	afterEach(async () => {
		await Promise.all(
			outputDirectories.splice(0).map((directory) =>
				rm(directory, {
					force: true,
					recursive: true,
				}),
			),
		);
	});

	it("generates operation references and a decorated API client", async () => {
		const outputDirectory = await mkdtemp(join(tmpdir(), "awilixify-codegen-"));
		outputDirectories.push(outputDirectory);

		const result = await generateOrvalApiClient({
			serviceName: "warehouse",
			openApi: {
				paths: {
					"/reservations": {
						post: {
							operationId: "createReservation",
							tags: ["reservations"],
						},
					},
					"/stock": {
						get: {
							operationId: "getStock",
							tags: ["inventory"],
						},
					},
				},
			},
			tags: ["reservations"],
			outputDirectory,
			generatedClientImport: "./warehouse.js",
			apiClientClassName: "WarehouseApiClient",
			operationsConstName: "WarehouseOperations",
			apiClientFileName: "warehouse-api-client.ts",
			operationsFileName: "warehouse.operations.ts",
			module: {
				outputPath: join(outputDirectory, "warehouse-gateway.module.ts"),
				moduleName: "WarehouseGatewayModule",
				apiClientProviderName: "warehouseApiClient",
				apiClientImport: "./generated/warehouse-api-client.js",
			},
		});

		if (!result.modulePath) throw new Error("Expected a generated module path");

		const apiClient = await readFile(result.apiClientPath, "utf8");
		const operations = await readFile(result.operationsPath, "utf8");
		const module = await readFile(result.modulePath, "utf8");

		expect(result.operationIds).toEqual(["createReservation"]);
		expect(apiClient).toContain(
			"@callsOperation(WarehouseOperations.createReservation)",
		);
		expect(apiClient).toContain(
			"createReservation as createReservationRequest",
		);
		expect(apiClient).not.toContain("getStock");
		expect(operations).toContain('"serviceName": "warehouse"');
		expect(operations).toContain('"operationId": "createReservation"');
		expect(operations).toContain('"transport": "http"');
		expect(module).toContain(
			"export const WarehouseGatewayModule = createModule<WarehouseGatewayModuleDef>",
		);
		expect(module).toContain("warehouseApiClient: WarehouseApiClient");
		expect(module).not.toContain("warehouseGateway:");
		expect(module).not.toContain("import { WarehouseGateway }");
		expect(result.moduleCreated).toBe(true);

		await writeFile(result.modulePath, "// Custom module\n");
		const secondResult = await generateOrvalApiClient({
			serviceName: "warehouse",
			openApi: { paths: {} },
			outputDirectory,
			generatedClientImport: "./warehouse.js",
			apiClientClassName: "WarehouseApiClient",
			operationsConstName: "WarehouseOperations",
			module: {
				outputPath: result.modulePath,
				moduleName: "WarehouseGatewayModule",
				apiClientProviderName: "warehouseApiClient",
				apiClientImport: "./generated/warehouse-api-client.js",
			},
		});

		expect(secondResult.moduleCreated).toBe(false);
		await expect(readFile(result.modulePath, "utf8")).resolves.toBe(
			"// Custom module\n",
		);
	});
});
