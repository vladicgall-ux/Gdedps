import { NextRequest, NextResponse } from 'next/server'

// Telegram webhook: replies to /start with a button that launches the Mini App.
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
  const chatId = update?.message?.chat?.id
  const text: string | undefined = update?.message?.text

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

  // Always 200 quickly -- Telegram retries on non-2xx and we don't want that
  // for update types we intentionally ignore (edits, other commands, etc).
  return NextResponse.json({ ok: true })
}
