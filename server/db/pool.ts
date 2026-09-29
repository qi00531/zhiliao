import { Pool } from 'pg'
import { readConfig } from '../config'

export function createPool(databaseUrl = readConfig(process.env).databaseUrl) {
  return new Pool({ connectionString: databaseUrl })
}
