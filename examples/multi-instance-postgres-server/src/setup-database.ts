import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { z } from "zod";

const databaseUrl = z.string().url().parse(process.env.DATABASE_URL);
const schema = await readFile(new URL("../schema.sql", import.meta.url), "utf8");
const database = new Pool({ connectionString: databaseUrl, max: 1 });
try {
  await database.query(schema);
  console.log("PostgreSQL schema ready");
} finally {
  await database.end();
}
