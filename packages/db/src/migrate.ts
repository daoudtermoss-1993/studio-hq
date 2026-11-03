import { pool, runMigrations } from "./index";

await runMigrations();
console.log("database migrated");
await pool().end();
