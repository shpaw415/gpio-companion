import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

export type CommerceDatabase = DrizzleD1Database<typeof schema>;

export function createCommerceDatabase(database: D1Database): CommerceDatabase {
	return drizzle(database, { schema });
}
