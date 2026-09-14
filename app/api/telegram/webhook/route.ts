import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { upsertUser } from '@/lib/auth/upsertUser'
import { telegramDisplayName } from '@/lib/auth/telegram'

// Telegram webhook: replies to /start with a button that launches the Mini
// App, accepts a 6-digit web-login code (sent as "/start 123456" via the
// t.me deep link, or typed directly), and saves the user's phone number
// when they share it via the native "share contact" popup
// (Telegram.WebApp.requestContact() on the client -- the number itself is
// never sent to the browser, only delivered here).
// Registered via `setWebhook` with a secret_token; every request is checked
// against that same secret before we trust the payload.
export async function POST(req: NextRequest) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!expectedSecret) {
    return NextResponse.json({ error: 'TELEGRAM_WEBHOOK_SECRET not configured' }, { status: 500 })
  }

  const receivedSecret = req.headers.get('x-telegram-bot-api-secret-token')
  if (receivedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  const appUrl = process.env.APP_URL
  if (!botToken || !appUrl) {
    return NextResponse.json({ error: 'bot not configured' }, { status: 500 })
  }

  async function sendMessage(chatId: number, text: string, replyMarkup?: object) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, reply_markup: replyMarkup })
    })
  }

  const update = await req.json().catch(() => null)
  const message = update?.message
  const chatId = message?.chat?.id
  const from = message?.from
  const text: string | undefined = message?.text

  const loginCodeMatch = typeof text === 'string' ? text.match(/^\/start\s+(\d{6})$|^(\d{6})$/) : null
  const loginCode = loginCodeMatch?.[1] ?? loginCodeMatch?.[2]

  if (chatId && loginCode && from?.id) {
    const db = supabaseAdmin()
    const { data: row } = await db
      .from('telegram_login_codes')
      .select('code, expires_at, claimed')
      .eq('code', loginCode)
      .maybeSingle()

    if (!row || row.claimed || new Date(row.expires_at).getTime() < Date.now()) {
      await sendMessage(chatId, '❌ Код неверный или устарел. Обновите код на сайте и попробуйте снова.')
    } else {
      await db
        .from('telegram_login_codes')
        .update({
          telegram_id: String(from.id),
          first_name: from.first_name ?? null,
          last_name: from.last_name ?? null,
          username: from.username ?? null,
          verified: true
        })
        .eq('code', loginCode)

      await sendMessage(chatId, '✅ Вход подтверждён! Вернитесь на сайт «Где ДПС?» — вы уже авторизованы.')
    }

    return NextResponse.json({ ok: true })
  }

  if (chatId && typeof text === 'string' && text.startsWith('/start')) {
    await sendMessage(
      chatId,
      '🚨 «Где ДПС?» — карта постов ДПС в реальном времени от сообщества.\n\nНажмите кнопку ниже, чтобы открыть карту.',
      { inline_keyboard: [[{ text: '🗺️ Открыть карту', web_app: { url: appUrl } }]] }
    )
    return NextResponse.json({ ok: true })
  }

  const contact = message?.contact
  // Only accept a contact the user shared about themselves, never a
  // forwarded contact card for someone else.
  if (chatId && contact?.phone_number && contact?.user_id && contact.user_id === from?.id) {
    await upsertUser({
      platform: 'telegram',
      platformId: String(contact.user_id),
      phone: contact.phone_number,
      displayName: telegramDisplayName({
        id: contact.user_id,
        first_name: contact.first_name,
        last_name: contact.last_name
      })
    })

    await sendMessage(chatId, '✅ Номер сохранён, спасибо!')
  }

  // Always 200 quickly -- Telegram retries on non-2xx and we don't want that
  // for update types we intentionally ignore (edits, other commands, etc).
  return NextResponse.json({ ok: true })
}
