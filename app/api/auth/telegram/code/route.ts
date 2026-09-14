import { randomInt } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rateLimit'

const CODE_TTL_SECONDS = 5 * 60

// POST: mint a fresh 6-digit login code the user sends to the bot.
// Avoids the Telegram Login Widget entirely (which requires the exact
// deployment domain to be registered via BotFather /setdomain and breaks
// every time that domain changes) -- this works from any browser, on any
// domain, with zero bot-side configuration beyond the webhook already set.
export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { key: 'auth:telegram-code:create', limit: 10, windowMs: 60_000 })
  if (limited) return limited

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME
  if (!botUsername) {
    return NextResponse.json({ error: 'Telegram bot not configured' }, { status: 500 })
  }

  const db = supabaseAdmin()
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')

  const { error } = await db.from('telegram_login_codes').insert({ code })
  if (error) {
    // Extremely unlikely collision with another still-live code -- ask the
    // client to retry rather than looping server-side.
    return NextResponse.json({ error: 'try_again' }, { status: 503 })
  }

  return NextResponse.json({ code, botUsername, expiresInSeconds: CODE_TTL_SECONDS })
}
