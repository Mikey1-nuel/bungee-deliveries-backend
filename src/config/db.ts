import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

export const pool = new Pool({
  host: process.env.PGHOST,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  port: Number(process.env.PGPORT),
});

console.log(
  "Connected to PostgreSQL pool at:",
  process.env.PGHOST,
  process.env.PGPORT,
  process.env.PGDATABASE
);
