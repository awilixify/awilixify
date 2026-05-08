# Module-Scoped Read/Write Database Access with Kysely

This pattern gives each module an explicit DB contract: which tables it can read and which it can modify.

### Why this is useful

- module boundaries are explicit at DB level (`readTables` and `writeTables`)
- write access is intentionally constrained per module
- reviewers can see table permissions directly in module imports

### 1. Define database tables once

`tables.types.ts`

```ts
export interface OwnersTable {
  id: string;
  name: string;
  email: string;
  createdAt: Date;
}

export interface CatsTable {
  id: string;
  ownerId: string;
  name: string;
  breed: string | null;
  age: number;
  createdAt: Date;
}

export interface TenantsTable {
  id: string;
  slug: string;
  displayName: string;
  createdAt: Date;
}

export interface Database {
  owners: OwnersTable;
  cats: CatsTable;
  tenants: TenantsTable;
}
```

### 2. Create typed `DbModule` with read/write scopes

`db.module.ts`

```ts
import { Kysely, PostgresDialect } from "kysely";
import pg from "pg";
import { createStaticModule, type ModuleDef } from "awilix-modular";
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

  return createStaticModule<DbModuleDef<TConfig>>({
    name: "DbModule",
    providers: { readQb, writeQb },
    exports: { readQb, writeQb },
  });
}
```

### 3. Declare scope in a feature module

`cats.module.ts`

```ts
const dbScope = {
  readTables: ["cats"],
  writeTables: ["cats"],
} as const;

export type CatsModuleDef = ModuleDef<{
  imports: [typeof OwnersModule, ReturnType<typeof DbModule<typeof dbScope>>];
  providers: {
    catsService: CatsService;
  };
}>;

export const CatsModule = createStaticModule<CatsModuleDef>({
  name: "CatsModule",
  imports: [OwnersModule, DbModule(dbScope)],
  providers: {
    catsService: CatsService,
  },
});
```

The important part is that table scope is visible at import site.

### 4. Use typed `readQb`/`writeQb` in service

```ts
class CatsService {
  constructor(
    private readonly readQb: Deps["readQb"],
    private readonly writeQb: Deps["writeQb"],
  ) {}

  async list() {
    return this.readQb.selectFrom("cats").selectAll().execute();
  }

  async rename(id: string, name: string) {
    await this.writeQb
      .updateTable("cats")
      .set({ name })
      .where("id", "=", id)
      .executeTakeFirst();
  }
}
```

### 5. What fails at compile time

If `cats` module scope is only `cats`, this becomes a type error:

```ts
// ❌ not allowed if "owners" is not in readTables
await this.readQb.selectFrom("owners").selectAll().execute();

// ❌ not allowed if "tenants" is not in writeTables
await this.writeQb.updateTable("tenants").set({ slug: "x" }).execute();
```

This is why it is useful for read/write separation: allowed tables are explicit, reviewable, and enforced by types.
