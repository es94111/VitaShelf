/**
 * Google SSO — optional. Enable by setting GOOGLE_CLIENT_ID env var.
 * Frontend sends the Google ID token; backend verifies it and issues a JWT.
 */
import { Router, type Request, type Response, type NextFunction } from 'express'
import https from 'node:https'
import jwt from 'jsonwebtoken'
import prisma from '../utils/prisma'
import { getClientIp, lookupCountry } from '../utils/ipCountry'

const router = Router()

interface GoogleTokenPayload {
  sub: string
  email: string
  email_verified: boolean
  name: string
  picture?: string
}

/** Verify Google ID token via Google's tokeninfo endpoint */
async function verifyGoogleToken(idToken: string): Promise<GoogleTokenPayload | null> {
  return new Promise((resolve) => {
    const url = `https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`
    https
      .get(url, { timeout: 5000 }, (res) => {
        let data = ''
        res.on('data', (chunk: Buffer) => { data += chunk.toString() })
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            if (json.error || !json.sub) { resolve(null); return }
            // Verify audience matches our client ID
            const clientId = process.env.GOOGLE_CLIENT_ID
            if (clientId && json.aud !== clientId) { resolve(null); return }
            resolve({
              sub: json.sub,
              email: json.email,
              email_verified: json.email_verified === 'true',
              name: json.name || json.email?.split('@')[0] || 'User',
              picture: json.picture,
            })
          } catch {
            resolve(null)
          }
        })
      })
      .on('error', () => resolve(null))
  })
}

// ─── POST /api/auth/google — Google SSO login/register ──────────────────────

router.post('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!process.env.GOOGLE_CLIENT_ID) {
      res.status(501).json({ message: 'Google 登入未啟用' })
      return
    }

    const { idToken } = req.body
    if (!idToken) {
      res.status(400).json({ message: '缺少 Google ID Token' })
      return
    }

    const payload = await verifyGoogleToken(idToken)
    if (!payload) {
      res.status(401).json({ message: 'Google 驗證失敗' })
      return
    }

    // Check registration policy for new users
    const existingUser = await prisma.user.findFirst({
      where: { OR: [{ googleId: payload.sub }, { email: payload.email }] },
    })

    if (!existingUser) {
      const settings = await prisma.adminSettings.findUnique({ where: { id: 'singleton' } })
      const userCount = await prisma.user.count()
      if (userCount > 0 && settings && !settings.registrationOpen) {
        res.status(403).json({ message: settings.registrationNotice || '目前不開放註冊' })
        return
      }
    }

    // Upsert user
    const userCount = await prisma.user.count()
    const role = userCount === 0 ? 'ADMIN' : undefined

    let user = existingUser
    if (user) {
      // Update googleId if linking an existing email account
      if (!user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: { googleId: payload.sub, authProvider: 'GOOGLE' },
        })
      }
    } else {
      user = await prisma.user.create({
        data: {
          email: payload.email,
          password: '', // No password for Google users
          displayName: payload.name,
          googleId: payload.sub,
          authProvider: 'GOOGLE',
          role: role ?? 'USER',
        },
      })
    }

    const token = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: '7d' },
    )

    // Log login
    const ip = getClientIp(req)
    lookupCountry(ip).then((country) => {
      prisma.loginLog.create({
        data: {
          userId: user!.id,
          email: user!.email,
          ip,
          country,
          method: 'google',
          success: true,
        },
      }).catch((err) => console.error('[LoginLog] Failed:', err))
    })

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        role: user.role,
        theme: user.theme,
      },
    })
  } catch (err) {
    next(err)
  }
})

// ─── GET /api/auth/google/enabled — check if Google SSO is available ────────

router.get('/google/enabled', (_req, res) => {
  res.json({
    enabled: !!process.env.GOOGLE_CLIENT_ID,
    clientId: process.env.GOOGLE_CLIENT_ID || null,
  })
})

export default router
