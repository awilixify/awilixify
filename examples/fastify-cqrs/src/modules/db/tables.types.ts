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
