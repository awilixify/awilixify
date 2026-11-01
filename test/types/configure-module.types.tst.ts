import { describe, expect, it } from "tstyche";
import { configureModule, createModule, type ModuleDef } from "../../index.js";

class ConfigService {
	getHost(): string {
		return "broker";
	}
}

class PrivateService {
	private declare readonly secret: never;
}

type ConfigDef = ModuleDef<{
	providers: {
		config: ConfigService;
		privateService: PrivateService;
		count: number;
	};
	exportKeys: ["config", "count"];
}>;

const configModule = createModule<ConfigDef>({
	name: "Config",
	providers: {
		config: ConfigService,
		privateService: PrivateService,
		count: 42,
	},
	exports: ["config", "count"],
});

describe("configureModule types", () => {
	it("infers arguments in injection order", () => {
		configureModule({
			imports: [configModule],
			inject: ["count", "config"],
			useFactory: (count, config) => {
				expect(count).type.toBe<number>();
				expect(config).type.toBe<ConfigService>();

				return { name: "Configured" };
			},
		});
	});

	it("rejects private and unknown injection keys", () => {
		expect(
			configureModule({
				imports: [configModule],
				inject: ["privateService"],
				useFactory: () => ({ name: "Configured" }),
			}),
		).type.toRaiseError();
		expect(
			configureModule({
				imports: [configModule],
				inject: ["missing"],
				useFactory: () => ({ name: "Configured" }),
			}),
		).type.toRaiseError();
	});

	it("preserves factory module exports for consumers and nested configuration", () => {
		type ResultDef = ModuleDef<{
			providers: { host: string };
			exportKeys: ["host"];
		}>;
		const configured = configureModule({
			imports: [configModule],
			inject: ["config"],
			useFactory: (config) =>
				createModule<ResultDef>({
					name: "Configured",
					providers: { host: config.getHost() },
					exports: ["host"],
				}),
		});

		type Consumer = ModuleDef<{ imports: [typeof configured] }>;
		expect<Consumer["deps"]["host"]>().type.toBe<string>();

		configureModule({
			imports: [configured],
			inject: ["host"],
			useFactory: (host) => {
				expect(host).type.toBe<string>();
				return { name: "Nested" };
			},
		});
	});

	it("preserves exports from a dynamic module returned by the factory", () => {
		class DatabaseService {
			constructor(public host: string) {}
		}
		type DatabaseDef = ModuleDef<{
			providers: { host: string; database: DatabaseService };
			exportKeys: ["database"];
		}>;
		function DatabaseModule(options: { host: string }) {
			return createModule<DatabaseDef>(
				{
					name: "Database",
					providers: { host: options.host, database: DatabaseService },
					exports: ["database"],
				},
				{ hashNameFrom: options },
			);
		}

		const configured = configureModule({
			imports: [configModule],
			inject: ["config"],
			useFactory: (config) => DatabaseModule({ host: config.getHost() }),
		});

		type Consumer = ModuleDef<{ imports: [typeof configured] }>;
		expect<Consumer["deps"]["database"]>().type.toBe<DatabaseService>();
		expect<Extract<"host", keyof Consumer["deps"]>>().type.toBe<never>();

		configureModule({
			imports: [configured],
			inject: ["database"],
			useFactory: (database) => {
				expect(database).type.toBe<DatabaseService>();
				return { name: "Consumer" };
			},
		});
	});

	it("rejects async factories", () => {
		expect(
			configureModule({
				imports: [],
				inject: [],
				useFactory: async () => ({ name: "Async" }),
			}),
		).type.toRaiseError();
	});

	it("rejects non-module factory results", () => {
		expect(
			configureModule({ imports: [], inject: [], useFactory: () => 42 }),
		).type.toRaiseError();
	});
});
