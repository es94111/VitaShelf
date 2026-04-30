// 合約測試輔助：載入 OpenAPI 3.2 spec → 建立 AJV validator；
// 讓測試可針對任一 endpoint 的任一 response schema 做 JSON Schema 驗證。
//
// 註：因 AJV 目前尚不支援 OpenAPI 3.2 的 Dialect，我們把 spec 的 3.2 當 3.1 處理
// （與 frontend/scripts/generate-api-types.mjs 相同策略）；JSON Schema Dialect
// 為 draft-2020-12。

import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'
import Ajv2020, { type ValidateFunction } from 'ajv/dist/2020'
import addFormats from 'ajv-formats'

const __dirname = dirname(fileURLToPath(import.meta.url))

const SPEC_PATH = resolve(__dirname, '../../../specs/001-auth-module/contracts/auth.openapi.yaml')

interface OpenApiSpec {
  components: {
    schemas: Record<string, object>
  }
  paths: Record<string, Record<string, {
    responses: Record<string, {
      content?: Record<string, { schema?: { $ref?: string } | object }>
    }>
  }>>
}

const raw = readFileSync(SPEC_PATH, 'utf8')
const spec = yaml.load(raw) as OpenApiSpec

const ajv = new Ajv2020({
  strict: false,             // spec 含 3.2 專屬欄位（如 example），非嚴格以免 AJV 拋錯
  allErrors: true,
})
addFormats(ajv)

// 將 components.schemas 全部加到 ajv，以便 $ref 能解析
for (const [name, schema] of Object.entries(spec.components.schemas)) {
  ajv.addSchema(schema, `#/components/schemas/${name}`)
}

/** 取得指定 endpoint + status + media-type 的 response validator。 */
export function getResponseValidator(
  path: string,
  method: string,
  status: string | number,
  mediaType = 'application/json',
): ValidateFunction {
  const op = spec.paths[path]?.[method.toLowerCase()]
  if (!op) throw new Error(`No operation: ${method} ${path}`)
  const resp = op.responses[String(status)]
  if (!resp) throw new Error(`No response ${status} for ${method} ${path}`)
  const schema = resp.content?.[mediaType]?.schema
  if (!schema) throw new Error(`No ${mediaType} schema for ${method} ${path} ${status}`)
  return ajv.compile(schema)
}

/** 回傳簡明錯誤訊息陣列（供 assert 失敗時列印）。 */
export function formatErrors(validate: ValidateFunction): string {
  return (validate.errors ?? [])
    .map((e) => `${e.instancePath || '/'} ${e.message ?? ''}`)
    .join('; ')
}
