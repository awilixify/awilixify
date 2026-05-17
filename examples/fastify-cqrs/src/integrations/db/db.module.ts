import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { createModule, type ModuleDef } from "awilixify";

import type { Database } from "./tables.types.js";

type TableName = keyof Database;
type NonEmptyTables = readonly [TableName, ...TableName[]];

type ReadQb<TTables extends readonly TableName[]> = Kysely<
	Pick<Database, TTables[number]>
>;

type WriteQb<TTables extends readonly TableName[]> = Kysely<
	Pick<Database, TTables[number]>
>;

type DbScopeConfig<
	TRead extends NonEmptyTables = NonEmptyTables,
	TWrite extends readonly TableName[] = readonly TableName[],
> = {
	readTables: TRead;
	writeTables: TWrite;
};

type DbModuleDef<TConfig extends DbScopeConfig> = ModuleDef<{
	providers: {
		readQb: ReadQb<TConfig["readTables"]>;
		writeQb: WriteQb<TConfig["writeTables"]>;
	};
	exportKeys: ["readQb", "writeQb"];
}>;

const pool = new pg.Pool({
	host: "localhost",
	port: 5444,
	user: "root",
	password: "root",
	database: "game_development",
});

const rootQb = new Kysely<Database>({
	dialect: new PostgresDialect({ pool }),
});

export function DbModule<const TConfig extends DbScopeConfig>(config: TConfig) {
	void config;

	const readQb = rootQb as unknown as ReadQb<TConfig["readTables"]>;
	const writeQb = rootQb as unknown as WriteQb<TConfig["writeTables"]>;

	return createModule<DbModuleDef<TConfig>>({
		name: "DbModule",

		providers: {
			readQb,
			writeQb,
		},

		exports: ["readQb", "writeQb"],
	});
}
