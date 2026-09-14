import { NextRequest, NextResponse } from 'next/server'
import { verifyTelegramLoginWidget, verifyTelegramWebAppInitData, telegramDisplayName } from '@/lib/auth/telegram'
import { upsertUser } from '@/lib/auth/upsertUser'
import { createSessionCookie } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 })
  }

  const body = await req.json()

  const tgUser = body.initData
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
