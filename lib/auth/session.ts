import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import type { SessionPayload } from '@/lib/types'

const COOKIE_NAME = 'gdedps_session'
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30 // 30 days

function secretKey() {
  const secret = process.env.SESSION_SECRET
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_SECRET is missing or too short (set it in .env)')
  }
  return new TextEncoder().encode(secret)
}

export async function createSessionCookie(payload: SessionPayload) {
  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secretKey())

  const isProd = process.env.NODE_ENV === 'production'

  cookies().set(COOKIE_NAME, token, {
    httpOnly: true,
    // sameSite: 'none' requires secure: true or browsers silently drop the
    // cookie -- so the two are tied together, not set independently. 'none'
    // is required in production so the cookie survives inside the TG/MAX
    // webview iframes (cross-site context); locally over plain http we fall
    // back to 'lax', which is the only mode a non-secure cookie can use.
    secure: isProd,
    sameSite: isProd ? 'none' : 'lax',
    path: '/',
    maxAge: MAX_AGE_SECONDS
  })
}

export function clearSessionCookie() {
  cookies().delete(COOKIE_NAME)
}

export async function getSession(): Promise<SessionPayload | null> {
  const token = cookies().get(COOKIE_NAME)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secretKey())
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function requireAdmin(): Promise<SessionPayload> {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    throw new Error('FORBIDDEN')
  }
  return session
}
