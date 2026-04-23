// 對應 research.md R-005（HS256 + 7d 過期）與 FR-008 / FR-009 / FR-012。
//
// JWT 僅經 httpOnly + Secure + SameSite=Strict cookie 下發與讀取；
// 此檔提供 sign/verify + cookie 字串序列化的 single source of truth。

import jwt from 'jsonwebtoken'

export interface JwtPayload {
  userId: string
  email: string
  role: string
  iat?: number
  exp?: number
}

const ALGORITHM: jwt.Algorithm = 'HS256'
const EXPIRES_IN = '7d'

// Cookie 選項與 Max-Age（秒），7 天 = 7 × 86400 = 604800 秒
export const COOKIE_NAME = 'token'
const COOKIE_MAX_AGE_SECONDS = 604800

function getSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET not configured')
  return secret
}

export function signToken(payload: Pick<JwtPayload, 'userId' | 'email' | 'role'>): string {
  return jwt.sign(payload, getSecret(), { algorithm: ALGORITHM, expiresIn: EXPIRES_IN })
}

/** 驗證 JWT 並返回 payload；algorithms 白名單避免 algorithm-confusion。 */
export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getSecret(), {
    algorithms: [ALGORITHM],
    clockTolerance: 60, // 60 秒容忍（對應 FR-012 / FR-012b）
  }) as JwtPayload
}

/** 登入成功下發的 Set-Cookie 字串（RFC 6265）。 */
export function authCookieSetHeader(token: string): string {
  return [
    `${COOKIE_NAME}=${token}`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    'Path=/',
    `Max-Age=${COOKIE_MAX_AGE_SECONDS}`,
  ].join('; ')
}

/** 登出 / 密碼變更後清除 cookie 的 Set-Cookie 字串。 */
export function clearAuthCookieHeader(): string {
  return [
    `${COOKIE_NAME}=`,
    'HttpOnly',
    'Secure',
    'SameSite=Strict',
    'Path=/',
    'Max-Age=0',
  ].join('; ')
}
