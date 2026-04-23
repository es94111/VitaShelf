#!/usr/bin/env node
/**
 * 從 OpenAPI 3.2 spec 產生前端 TypeScript 型別。
 *
 * 目前 `openapi-typescript`（via `@redocly/openapi-core`）尚未支援 3.2；
 * 憲法 Principle II 要求 spec 檔案保持 `openapi: 3.2.x`，我們以此腳本
 * 在 **codegen 時暫時** 將版本字串轉為 3.1.0 寫入暫存檔再跑 codegen，
 * 確保 source spec 不被動到。
 *
 * Usage: node scripts/generate-api-types.mjs <input.yaml> <output.d.ts>
 */

import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [, , input, output] = process.argv
if (!input || !output) {
  console.error('Usage: generate-api-types.mjs <input.yaml> <output.d.ts>')
  process.exit(1)
}

const source = readFileSync(input, 'utf8')
const transformed = source.replace(/^openapi:\s*3\.2(\.\d+)?\s*$/m, 'openapi: 3.1.0')

const tmpFile = join(tmpdir(), `openapi-3.1-codegen-${Date.now()}.yaml`)
writeFileSync(tmpFile, transformed, 'utf8')

try {
  const result = spawnSync('npx', ['openapi-typescript', tmpFile, '-o', output], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })
  if (result.status !== 0) {
    process.exit(result.status ?? 1)
  }
  console.log(`✔ Generated ${output} from ${input} (3.2 → 3.1 transform for codegen)`)
} finally {
  try { unlinkSync(tmpFile) } catch { /* ignore */ }
}
