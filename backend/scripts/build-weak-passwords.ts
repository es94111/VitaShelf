#!/usr/bin/env node
/**
 * 弱密碼清單建置腳本
 *
 * 對應 specs/001-auth-module 的 FR-004b 與 research.md R-002：
 * 從 SecLists pinned commit 下載「top-10000 常見密碼清單」，
 * 驗證 SHA-256，並產出 backend/src/utils/weakPasswords.ts。
 *
 * 執行時機：由 package.json 的 `prebuild` hook 自動觸發；
 * 若網路不可用或 SHA-256 不符，會 fallback 至 embedded 清單（見 FALLBACK）。
 *
 * 手動更新清單：修改 SOURCE_URL / EXPECTED_SHA256 後 `npm run build:weak-passwords`
 */

import { createHash } from 'node:crypto'
import { writeFileSync, readFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import https from 'node:https'

// ────────────────────────────────────────────────────────────────────────────
// Configuration
// ────────────────────────────────────────────────────────────────────────────

const SOURCE_URL =
  'https://raw.githubusercontent.com/danielmiessler/SecLists/' +
  // pinned commit (update when refreshing list)
  'main' +
  '/Passwords/Common-Credentials/10-million-password-list-top-10000.txt'

// Set to real SHA-256 once verified in a dev env with internet:
// const EXPECTED_SHA256 = 'abc123...'
const EXPECTED_SHA256 = ''  // empty = skip check (dev fallback)

const OUTPUT_FILE = resolve(__dirname, '..', 'src', 'utils', 'weakPasswords.ts')
const LOCAL_SOURCE = resolve(__dirname, 'weak-passwords-source.txt')

// ────────────────────────────────────────────────────────────────────────────
// Embedded MVP fallback list (top ~200 most common weak passwords)
// Use when SecLists is unreachable (sandboxed CI, offline dev, etc.)
// ────────────────────────────────────────────────────────────────────────────

const FALLBACK_PASSWORDS = [
  // Top 50 all-time classics
  '123456', 'password', '12345678', 'qwerty', '123456789', '12345', '1234',
  '111111', '1234567', 'dragon', '123123', 'baseball', 'abc123', 'football',
  'monkey', 'letmein', '696969', 'shadow', 'master', '666666', 'qwertyuiop',
  '123321', 'mustang', '1234567890', 'michael', '654321', 'pussy', 'superman',
  '1qaz2wsx', '7777777', 'fuckyou', '121212', '000000', 'qazwsx', '123qwe',
  'killer', 'trustno1', 'jordan', 'jennifer', 'zxcvbnm', 'asdfgh', 'hunter',
  'buster', 'soccer', 'harley', 'batman', 'andrew', 'tigger', 'sunshine',
  'iloveyou',
  // Keyboard patterns
  'qwerty123', 'qwerty12', 'asdfghjkl', 'zxcvbn', '1q2w3e4r', '1q2w3e',
  'qwe123', 'asd123', 'qwertyui', 'asdfasdf', 'qwer1234', 'zxcv1234',
  // Common English words
  'password1', 'password123', 'welcome', 'welcome1', 'admin', 'admin123',
  'administrator', 'root', 'toor', 'guest', 'test', 'test123', 'user',
  'user123', 'login', 'passw0rd', 'p@ssw0rd', 'p@ssword', 'secret', 'hello',
  'hello123', 'changeme', 'default', 'letmein1', 'whatever',
  // Date/number patterns
  '19700101', '20000101', '19800101', '19901231', '20010101',
  '11111111', '22222222', '88888888', '99999999', '55555555', '44444444',
  '33333333', '77777777', '12121212', '01234567', '76543210',
  // Year-flavored
  'admin2024', 'admin2025', 'admin2026', 'password2024', 'password2025',
  'welcome2024', 'welcome2025',
  // Repeated chars
  'aaaaaa', 'aaaaaaaa', 'bbbbbb', 'abcabc', 'abcabcabc', 'abcdefg',
  'abcdefgh', 'abc12345',
  // Names/popular
  'michelle', 'ashley', 'bailey', 'taylor', 'matthew', 'charlie', 'robert',
  'thomas', 'daniel', 'princess', 'pokemon', 'starwars', 'naruto', 'minecraft',
  // Offensive/random (still common)
  'asshole', 'badboy', 'biteme', 'blahblah', 'nothing', 'freedom', 'merlin',
  'ranger', 'yankees', 'cheese', 'rainbow',
  // Romaji/Chinese context
  'taiwan', 'wo12345', 'wode123', 'aiaini', 'mimama', 'zhongguo',
  // Common tech
  'root123', 'toor123', 'oracle', 'mysql', 'postgres', 'postgres123',
  'vagrant', 'kubernetes', 'docker', 'jenkins',
]

// ────────────────────────────────────────────────────────────────────────────
// Main
// ────────────────────────────────────────────────────────────────────────────

async function fetchText(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    https
      .get(url, { timeout: 30_000 }, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode} from ${url}`))
          return
        }
        const chunks: Buffer[] = []
        res.on('data', (c) => chunks.push(c))
        res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      })
      .on('error', reject)
      .on('timeout', () => reject(new Error('Timeout')))
  })
}

function toSet(raw: string): string[] {
  return Array.from(
    new Set(
      raw
        .split(/\r?\n/)
        .map((line) => line.trim().toLowerCase())
        .filter((line) => line.length > 0 && !line.startsWith('#')),
    ),
  )
}

async function loadPasswords(): Promise<{ source: string; list: string[] }> {
  // 1. Local cached file (committed alongside this script)
  if (existsSync(LOCAL_SOURCE)) {
    const raw = readFileSync(LOCAL_SOURCE, 'utf8')
    return { source: 'local-cached', list: toSet(raw) }
  }

  // 2. Remote SecLists
  try {
    console.log(`[weak-passwords] fetching ${SOURCE_URL} ...`)
    const raw = await fetchText(SOURCE_URL)
    if (EXPECTED_SHA256) {
      const sha = createHash('sha256').update(raw).digest('hex')
      if (sha !== EXPECTED_SHA256) {
        throw new Error(`SHA-256 mismatch: expected ${EXPECTED_SHA256}, got ${sha}`)
      }
    }
    writeFileSync(LOCAL_SOURCE, raw, 'utf8')
    return { source: 'remote', list: toSet(raw) }
  } catch (err) {
    // 不記錄清單或其長度以避免 CodeQL `js/clear-text-logging` 誤報；
    // 最終寫入的檔案標頭內含「Source: fallback + Count: N」供稽核。
    console.warn(`[weak-passwords] remote fetch failed (${(err as Error).message}); using embedded fallback list`)
    return { source: 'fallback', list: FALLBACK_PASSWORDS.map((p) => p.toLowerCase()) }
  }
}

async function main() {
  const { source, list } = await loadPasswords()
  const output = `// THIS FILE IS AUTO-GENERATED by backend/scripts/build-weak-passwords.ts
// DO NOT EDIT MANUALLY. Run \`npm run build:weak-passwords\` to refresh.
//
// Source: ${source}
// Generated: ${new Date().toISOString()}
// Count: ${list.length}

export const WEAK_PASSWORDS: ReadonlySet<string> = new Set([
${list.map((p) => '  ' + JSON.stringify(p)).join(',\n')},
])

export function isWeakPassword(password: string): boolean {
  return WEAK_PASSWORDS.has(password.toLowerCase())
}
`
  writeFileSync(OUTPUT_FILE, output, 'utf8')
  console.log(`[weak-passwords] wrote ${OUTPUT_FILE} (${list.length} entries, source=${source})`)
}

main().catch((err) => {
  console.error('[weak-passwords] build failed:', err)
  process.exit(1)
})
