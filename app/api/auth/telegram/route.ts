import { NextRequest, NextResponse } from 'next/server'
import { verifyTelegramLoginWidget, verifyTelegramWebAppInitData, telegramDisplayName } from '@/lib/auth/telegram'
import { upsertUser } from '@/lib/auth/upsertUser'
import { createSessionCookie } from '@/lib/auth/session'
import { rateLimit } from '@/lib/rateLimit'
import { telegramAuthSchema } from '@/lib/validation'

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { key: 'auth:telegram', limit: 10, windowMs: 60_000 })
  if (limited) return limited

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 })
  }

  const parsed = telegramAuthSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  }
  const body = parsed.data

  const tgUser =
    'initData' in body
      ? verifyTelegramWebAppInitData(body.initData as string, botToken)
      : verifyTelegramLoginWidget(body as Record<string, string | number>, botToken)

  if (!tgUser) {
    return NextResponse.json({ error: 'invalid_telegram_signature' }, { status: 401 })
  }

  const user = await upsertUser({
    platform: 'telegram',
    platformId: String(tgUser.id),
    displayName: telegramDisplayName(tgUser),
    avatarUrl: tgUser.photo_url ?? null
  })

  await createSessionCookie({ sub: user.id, platform: 'telegram', role: user.role, name: user.display_name })

  return NextResponse.json({ user })
}
