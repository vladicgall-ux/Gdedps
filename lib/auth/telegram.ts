import { createHash, createHmac, timingSafeEqual } from 'node:crypto'

interface TelegramUser {
  id: number
  first_name?: string
  last_name?: string
  username?: string
  photo_url?: string
}

function safeEqualHex(a: string, b: string) {
  const bufA = Buffer.from(a, 'hex')
  const bufB = Buffer.from(b, 'hex')
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

function buildDataCheckString(params: URLSearchParams, exclude: string[]) {
  return [...params.entries()]
    .filter(([key]) => !exclude.includes(key))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('\n')
}

/**
 * Verifies `Telegram.WebApp.initData` sent by a Mini App.
 * https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
 */
export function verifyTelegramWebAppInitData(initData: string, botToken: string): TelegramUser | null {
  const params = new URLSearchParams(initData)
  const hash = params.get('hash')
  if (!hash) return null

  const dataCheckString = buildDataCheckString(params, ['hash'])
  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest()
  const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (!safeEqualHex(computedHash, hash)) return null

  const authDate = Number(params.get('auth_date') ?? 0)
  if (!authDate || Date.now() / 1000 - authDate > 86400) return null // initData valid for 24h

  const userRaw = params.get('user')
  if (!userRaw) return null
  return JSON.parse(userRaw) as TelegramUser
}

/**
 * Verifies the payload posted by the Telegram Login Widget (web version).
 * https://core.telegram.org/widgets/login#checking-authorization
 */
export function verifyTelegramLoginWidget(
  data: Record<string, string | number>,
  botToken: string
): TelegramUser | null {
  const { hash, ...rest } = data as Record<string, string>
  if (!hash) return null

  const authDate = Number(rest.auth_date ?? 0)
  if (!authDate || Date.now() / 1000 - authDate > 86400) return null

  const dataCheckString = Object.keys(rest)
    .sort()
    .map((key) => `${key}=${rest[key]}`)
    .join('\n')

  const secretKey = createHash('sha256').update(botToken).digest()
  const computedHash = createHmac('sha256', secretKey).update(dataCheckString).digest('hex')

  if (!safeEqualHex(computedHash, String(hash))) return null

  return {
    id: Number(rest.id),
    first_name: rest.first_name,
    last_name: rest.last_name,
    username: rest.username,
    photo_url: rest.photo_url
  }
}

export function telegramDisplayName(user: TelegramUser) {
  return [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username || `tg${user.id}`
}
