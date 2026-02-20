import fs from "fs/promises";
import path from "path";

import dotenv from "dotenv";
import pg from "pg";

dotenv.config();

const { Pool } = pg;

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not set");
  }

  const sqlPath = path.resolve(process.cwd(), "sql", "init.sql");
  const sql = await fs.readFile(sqlPath, "utf8");

  const pool = new Pool({ connectionString: databaseUrl });
  try {
    await pool.query(sql);
    console.log("DB schema initialized successfully");
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("DB init failed:", err.message);
  process.exit(1);
});
