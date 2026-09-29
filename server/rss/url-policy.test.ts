// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { createUrlPolicy, normalizeFeedUrl, UrlPolicyError } from './url-policy'

const dns: Record<string, string[]> = {
  'public.test': ['93.184.216.34'],
  'private.test': ['10.0.0.4'],
  'mixed.test': ['93.184.216.34', '192.168.1.2'],
  'loopback-v6.test': ['::1'],
  'docs-v6.test': ['2001:db8::1'],
}

const policy = createUrlPolicy(async (hostname) =>
  (dns[hostname] ?? []).map((address) => ({
    address,
    family: address.includes(':') ? 6 : 4,
  })),
)

describe('RSS URL policy', () => {
  it.each([
    ['http://127.0.0.1/feed'],
    ['http://169.254.169.254/latest/meta-data'],
    ['http://10.0.0.1/feed'],
    ['http://[::1]/feed'],
    ['http://private.test/feed'],
    ['http://mixed.test/feed'],
    ['http://loopback-v6.test/feed'],
    ['http://docs-v6.test/feed'],
  ])('rejects non-public destination %s', async (url) => {
    await expect(policy.assertPublicHttpUrl(url)).rejects.toBeInstanceOf(UrlPolicyError)
  })

  it.each([
    ['file:///etc/passwd'],
    ['ftp://public.test/feed'],
    ['https://user:secret@public.test/feed'],
  ])('rejects unsupported or credential-bearing URL %s', async (url) => {
    await expect(policy.assertPublicHttpUrl(url)).rejects.toBeInstanceOf(UrlPolicyError)
  })

  it('accepts a public host only when every DNS answer is public', async () => {
    await expect(policy.assertPublicHttpUrl('https://public.test/feed')).resolves.toBe(
      'https://public.test/feed',
    )
  })

  it('normalizes fragments, host casing, and default ports', () => {
    expect(normalizeFeedUrl('HTTPS://Public.Test:443/feed#latest')).toBe(
      'https://public.test/feed',
    )
  })

  it('rejects a redirect target that resolves to private space', async () => {
    await policy.assertPublicHttpUrl('https://public.test/feed')
    await expect(policy.assertPublicHttpUrl('http://private.test/redirected')).rejects.toMatchObject({
      code: 'PRIVATE_NETWORK_URL',
    })
  })
})
