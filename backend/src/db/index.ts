import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.ts';
import { config } from 'dotenv';
config();
config({ path: '.env.local', override: true });

const sql = postgres(process.env.DATABASE_URL!);
export const db = drizzle(sql, { schema });