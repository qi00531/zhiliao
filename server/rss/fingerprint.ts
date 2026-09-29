import { createHash } from 'node:crypto'

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

export function contentFingerprint(title: string, summaryText: string, url: string | null) {
  return sha256(JSON.stringify([title, summaryText, url]))
}
