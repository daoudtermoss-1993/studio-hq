import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

export * from "./schema";
export { schema };
export { and, asc, count, desc, eq, gte, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from "drizzle-orm";

export type DB = NodePgDatabase<typeof schema>;

const g = globalThis as unknown as { __studioDb?: DB; __studioPool?: Pool };

/** One pool per process (Next.js dev reloads would otherwise open many). */
export function pool(): Pool {
  g.__studioPool ??= new Pool({
    connectionString: process.env.DATABASE_URL ?? "postgresql://studio:studio@localhost:5432/studio",
    max: Number(process.env.DB_POOL_MAX || 10),
  });
  return g.__studioPool;
}

export const db: DB = (g.__studioDb ??= drizzle(pool(), { schema }));

/** Applies pending SQL migrations from packages/db/migrations. */
export async function runMigrations(folder?: string) {
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const here = path.dirname(fileURLToPath(import.meta.url));
  await migrate(db, { migrationsFolder: folder ?? path.resolve(here, "../migrations") });
}
