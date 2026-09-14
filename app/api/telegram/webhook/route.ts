import { NextRequest, NextResponse } from 'next/server'
import { upsertUser } from '@/lib/auth/upsertUser'
import { telegramDisplayName } from '@/lib/auth/telegram'

// Telegram webhook: replies to /start with a button that launches the Mini
// App, and saves the user's phone number when they share it via the native
// "share contact" popup (Telegram.WebApp.requestContact() on the client --
// the number itself is never sent to the browser, only delivered here).
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

  const update = await req.json().catch(() => null)
  const message = update?.message
  const chatId = message?.chat?.id
  const text: string | undefined = message?.text

  if (chatId && typeof text === 'string' && text.startsWith('/start')) {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: '🚨 «Где ДПС?» — карта постов ДПС в реальном времени от сообщества.\n\nНажмите кнопку ниже, чтобы открыть карту.',
        reply_markup: {
          inline_keyboard: [[{ text: '🗺️ Открыть карту', web_app: { url: appUrl } }]]
        }
      })
    })
  }

  const contact = message?.contact
  const fromId = message?.from?.id
  // Only accept a contact the user shared about themselves, never a
  // forwarded contact card for someone else.
  if (chatId && contact?.phone_number && contact?.user_id && contact.user_id === fromId) {
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

    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: '✅ Номер сохранён, спасибо!' })
    })
  }

  // Always 200 quickly -- Telegram retries on non-2xx and we don't want that
  // for update types we intentionally ignore (edits, other commands, etc).
  return NextResponse.json({ ok: true })
}
