import https from 'node:https'
import http from 'node:http'

const PRIVATE_RANGES = [
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[01])\./,
  /^192\.168\./,
  /^::1$/,
  /^0\.0\.0\.0$/,
  /^fd[0-9a-f]{2}:/i,
  /^fe80:/i,
  /^localhost$/i,
]

/** Resolve client IP from request headers / socket */
export function getClientIp(req: { headers: Record<string, string | string[] | undefined>; socket?: { remoteAddress?: string } }): string {
  const forwarded = req.headers['x-forwarded-for']
  if (forwarded) {
    const first = (Array.isArray(forwarded) ? forwarded[0] : forwarded).split(',')[0].trim()
    if (first) return first
  }
  const real = req.headers['x-real-ip']
  if (real) return Array.isArray(real) ? real[0] : real
  return req.socket?.remoteAddress ?? '0.0.0.0'
}

/** Check if IP is a private/local address */
function isPrivateIp(ip: string): boolean {
  return PRIVATE_RANGES.some((r) => r.test(ip))
}

/** Lookup country code from ipinfo.io. Returns 'LOCAL' for private IPs, '' on error. */
export async function lookupCountry(ip: string): Promise<string> {
  if (isPrivateIp(ip)) return 'LOCAL'

  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(''), 3000)
    const client = ip.includes(':') ? http : https
    const url = `https://ipinfo.io/${encodeURIComponent(ip)}/json`

    client
      .get(url, { timeout: 3000 }, (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => {
          clearTimeout(timeout)
          try {
            const json = JSON.parse(data)
            resolve(json.country ?? '')
          } catch {
            resolve('')
          }
        })
      })
      .on('error', () => {
        clearTimeout(timeout)
        resolve('')
      })
  })
}
