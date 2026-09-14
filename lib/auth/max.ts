import { createHmac, timingSafeEqual } from 'node:crypto'

/**
 * MAX (max.ru) messenger auth adapter.
 *
 * MAX's public developer docs / stable API surface were not available at
 * build time, so this mirrors the same "share phone number" pattern used by
 * Telegram bots (a bot-issued, HMAC-signed payload containing the user id +
 * phone number, forwarded from the MAX client to our backend). Once you have
 * real MAX API credentials/docs, only this file and
 * app/api/auth/max/route.ts should need to change -- everything downstream
 * (session, upsertUser, UI) is provider-agnostic.
 */

interface MaxSharedContact {
  id: string
  phone: string
  firstName?: string
  lastName?: string
  avatarUrl?: string
}

function safeEqualHex(a: string, b: string) {
  const bufA = Buffer.from(a, 'hex')
  const bufB = Buffer.from(b, 'hex')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

export function verifyMaxSharedContact(
  payload: { id: string; phone: string; first_name?: string; last_name?: string; avatar_url?: string; ts: number; sign: string },
  appSecret: string
): MaxSharedContact | null {
  const { sign, ...rest } = payload
  if (!sign) return null

  // auth payload valid for 10 minutes
  if (!rest.ts || Date.now() / 1000 - rest.ts > 600) return null

  const dataCheckString = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${(rest as Record<string, unknown>)[key]}`)
    .join('\n')

  const computed = createHmac('sha256', appSecret).update(dataCheckString).digest('hex')
  if (!safeEqualHex(computed, sign)) return null

  return {
    id: rest.id,
    phone: rest.phone,
    firstName: rest.first_name,
    lastName: rest.last_name,
    avatarUrl: rest.avatar_url
  }
}

export function maxDisplayName(user: MaxSharedContact) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || user.phone
}
