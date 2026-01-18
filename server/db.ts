import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";

// Railway 데이터베이스 우선 사용, 없으면 Replit 내장 DB 사용
const connectionString = process.env.RAILWAY_DATABASE_URL || process.env.DATABASE_URL;

const pool = new pg.Pool({
  connectionString,
});

export const db = drizzle(pool);
