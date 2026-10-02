import { existsSync, readFileSync } from 'node:fs'
import { connect } from 'node:net'
import { spawn, spawnSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

export function parseEnvFile(content: string, current: NodeJS.ProcessEnv = process.env) {
  const parsed: NodeJS.ProcessEnv = { ...current }
  for (const raw of content.split(/\r?\n/)) {
    const line = raw.trim()
    if (!line || line.startsWith('#')) continue
    const separator = line.indexOf('=')
    if (separator < 1) continue
    const key = line.slice(0, separator).trim()
    const value = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, '$2')
    if (parsed[key] === undefined) parsed[key] = value
  }
  return parsed
}

export function databaseEndpoint(databaseUrl: string) {
  const url = new URL(databaseUrl)
  return { host: url.hostname, port: Number(url.port || 5432) }
}

async function waitForDatabase(databaseUrl: string, timeoutMs = 30_000) {
  const endpoint = databaseEndpoint(databaseUrl)
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const available = await new Promise<boolean>((resolve) => {
      const socket = connect(endpoint, () => { socket.end(); resolve(true) })
      socket.setTimeout(1_000)
      socket.on('timeout', () => { socket.destroy(); resolve(false) })
      socket.on('error', () => resolve(false))
    })
    if (available) return
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('数据库未在 30 秒内就绪')
}

function runChecked(command: string, args: string[], env: NodeJS.ProcessEnv) {
  const result = spawnSync(command, args, { stdio: 'inherit', env })
  if (result.error) throw new Error(`${command} 不可用：${result.error.message}`)
  if (result.status !== 0) throw new Error(`${command} ${args.join(' ')} 执行失败`)
}

export async function main() {
  if (!existsSync('.env')) throw new Error('缺少 .env，请先复制 .env.example')
  const env = parseEnvFile(readFileSync('.env', 'utf8'))
  const databaseUrl = env.DATABASE_URL
  if (!databaseUrl) throw new Error('.env 缺少 DATABASE_URL')
  runChecked('docker', ['compose', 'up', '-d', 'db'], env)
  await waitForDatabase(databaseUrl)
  runChecked('npm', ['run', 'db:migrate'], env)
  const application = spawn('npm', ['run', 'dev:all'], { stdio: 'inherit', env })
  const stop = (signal: NodeJS.Signals) => application.kill(signal)
  process.once('SIGINT', () => stop('SIGINT'))
  process.once('SIGTERM', () => stop('SIGTERM'))
  const code = await new Promise<number>((resolve) => application.once('exit', (value) => resolve(value ?? 1)))
  process.exitCode = code
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1 })
}
