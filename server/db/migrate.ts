import { readdir, readFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Pool, type PoolClient, type QueryResult } from 'pg'
import { createPool } from './pool'

type Queryable = {
  query(text: string, values?: unknown[]): Promise<QueryResult>
}

const migrationsDirectory = join(dirname(fileURLToPath(import.meta.url)), 'migrations')

async function applyMigrations(target: Queryable) {
  await target.query(`create table if not exists schema_migrations (
    version text primary key,
    applied_at timestamptz not null default now()
  )`)

  const files = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort()

  for (const file of files) {
    const seen = await target.query('select 1 from schema_migrations where version = $1', [file])
    if (seen.rowCount) continue
    await target.query(await readFile(join(migrationsDirectory, file), 'utf8'))
    await target.query('insert into schema_migrations (version) values ($1)', [file])
  }
}

function isPool(target: Pool | PoolClient): target is Pool {
  return target instanceof Pool
}

export async function migrate(target: Pool | PoolClient) {
  if (!isPool(target)) {
    await applyMigrations(target)
    return
  }

  const client = await target.connect()
  try {
    await client.query('select pg_advisory_lock($1)', [2_026_092_001])
    await client.query('begin')
    await applyMigrations(client)
    await client.query('commit')
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    await client.query('select pg_advisory_unlock($1)', [2_026_092_001])
    client.release()
  }
}

async function main() {
  const pool = createPool()
  try {
    await migrate(pool)
  } finally {
    await pool.end()
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main()
}
