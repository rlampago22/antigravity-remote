import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from './schema';

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL não configurada.');
  }
  const sql = neon(url);
  return drizzle(sql, { schema });
}

type DbInstance = ReturnType<typeof createDb>;

let _db: DbInstance | null = null;

export function getDb(): DbInstance {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

export * from './schema';
