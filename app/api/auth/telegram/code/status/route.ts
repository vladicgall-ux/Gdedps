import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { rateLimit } from '@/lib/rateLimit'
import { upsertUser } from '@/lib/auth/upsertUser'
import { createSessionCookie } from '@/lib/auth/session'
import { telegramLoginCodeSchema } from '@/lib/validation'

// GET: the web login page polls this while the user is sending the code to
// the bot. Codes are single-use (claimed flag) and short-lived (checked
// against expires_at), and this route is rate-limited per IP to make
// guessing someone else's pending 6-digit code impractical within its
// 5-minute window.
export async function GET(req: NextRequest) {
  const limited = rateLimit(req, { key: 'auth:telegram-code:status', limit: 30, windowMs: 60_000 })
  if (limited) return limited

  const parsed = telegramLoginCodeSchema.safeParse({ code: req.nextUrl.searchParams.get('code') })
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_code' }, { status: 400 })
  }

  const db = supabaseAdmin()
  const { data: row, error } = await db
    .from('telegram_login_codes')
    .select('*')
    .eq('code', parsed.data.code)
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    return NextResponse.json({ status: 'expired' })
  }
  if (row.claimed) {
    return NextResponse.json({ status: 'expired' })
  }
  if (!row.verified || !row.telegram_id) {
    return NextResponse.json({ status: 'pending' })
  }

  // Atomically claim the code so a second poll (or a replay of this
  // response) can never create a second session from it.
  const { data: claimedRow, error: claimError } = await db
    .from('telegram_login_codes')
    .update({ claimed: true })
    .eq('code', parsed.data.code)
    .eq('claimed', false)
    .select('*')
    .maybeSingle()

  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 })
  if (!claimedRow) return NextResponse.json({ status: 'expired' })

  const displayName =
    [claimedRow.first_name, claimedRow.last_name].filter(Boolean).join(' ') ||
    claimedRow.username ||
    `tg${claimedRow.telegram_id}`

  const user = await upsertUser({
    platform: 'telegram',
    platformId: String(claimedRow.telegram_id),
    displayName
  })

  await createSessionCookie({ sub: user.id, platform: 'telegram', role: user.role, name: user.display_name })

  return NextResponse.json({ status: 'ok', user })
}
