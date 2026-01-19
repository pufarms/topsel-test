import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// Replit 내장 DB 사용
const connectionString = process.env.DATABASE_URL;

const pool = new pg.Pool({
  connectionString,
});

export const db = drizzle(pool);
