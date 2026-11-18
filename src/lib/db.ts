import pg, { type PoolClient, type QueryResultRow } from "pg";

export const pool = new pg.Pool({
  host: process.env.PG_HOST ?? "db",
  port: Number(process.env.PG_PORT ?? 5432),
  user: process.env.PG_USER ?? "ielts",
  password: process.env.PG_PASSWORD,
  database: process.env.PG_DB ?? "ielts",
  max: 4,
  connectionTimeoutMillis: 5000,
  statement_timeout: 10000,
});

export async function query<T extends QueryResultRow>(sql: string, values: unknown[] = []): Promise<T[]> {
  return (await pool.query<T>(sql, values)).rows;
}

export async function transaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally { client.release(); }
}
