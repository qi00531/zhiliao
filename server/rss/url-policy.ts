import { lookup } from 'node:dns/promises'
import { BlockList, isIP } from 'node:net'

type Address = { address: string; family: number }
export type ResolveAddresses = (hostname: string) => Promise<Address[]>

export class UrlPolicyError extends Error {
  constructor(
    public readonly code: 'INVALID_URL' | 'UNSUPPORTED_PROTOCOL' | 'URL_CREDENTIALS' | 'DNS_LOOKUP_FAILED' | 'PRIVATE_NETWORK_URL',
    message: string,
  ) {
    super(message)
    this.name = 'UrlPolicyError'
  }
}

const blockedAddresses = new BlockList()

for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
] as const) {
  blockedAddresses.addSubnet(network, prefix, 'ipv4')
}

for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blockedAddresses.addSubnet(network, prefix, 'ipv6')
}

function parseUrl(input: string) {
  try {
    return new URL(input)
  } catch {
    throw new UrlPolicyError('INVALID_URL', '请输入完整的 RSS 地址')
  }
}

export function normalizeFeedUrl(input: string) {
  const url = parseUrl(input.trim())
  url.hash = ''
  url.hostname = url.hostname.toLowerCase()
  if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) {
    url.port = ''
  }
  return url.toString()
}

function bareHostname(hostname: string) {
  return hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname
}

function isBlocked(address: string) {
  if (address.toLowerCase().startsWith('::ffff:')) return true
  const family = isIP(address)
  if (family === 4) return blockedAddresses.check(address, 'ipv4')
  if (family === 6) return blockedAddresses.check(address, 'ipv6')
  return true
}

const systemResolver: ResolveAddresses = (hostname) => lookup(hostname, { all: true, verbatim: true })

export function createUrlPolicy(resolveAddresses: ResolveAddresses = systemResolver) {
  async function assertPublicHttpUrl(input: string) {
    const normalized = normalizeFeedUrl(input)
    const url = parseUrl(normalized)

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new UrlPolicyError('UNSUPPORTED_PROTOCOL', '只支持 HTTP 或 HTTPS 地址')
    }
    if (url.username || url.password) {
      throw new UrlPolicyError('URL_CREDENTIALS', 'RSS 地址不能包含账号或密码')
    }

    const hostname = bareHostname(url.hostname)
    let addresses: Address[]
    if (isIP(hostname)) {
      addresses = [{ address: hostname, family: isIP(hostname) }]
    } else {
      try {
        addresses = await resolveAddresses(hostname)
      } catch {
        throw new UrlPolicyError('DNS_LOOKUP_FAILED', '无法解析这个地址')
      }
    }

    if (addresses.length === 0) {
      throw new UrlPolicyError('DNS_LOOKUP_FAILED', '无法解析这个地址')
    }
    if (addresses.some(({ address }) => isBlocked(address))) {
      throw new UrlPolicyError('PRIVATE_NETWORK_URL', '不能接入本机或内网地址')
    }
    return normalized
  }

  return { assertPublicHttpUrl }
}

export const { assertPublicHttpUrl } = createUrlPolicy()
