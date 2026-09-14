import { NextRequest, NextResponse } from 'next/server'
import { verifyMaxSharedContact, maxDisplayName } from '@/lib/auth/max'
import { upsertUser } from '@/lib/auth/upsertUser'
import { createSessionCookie } from '@/lib/auth/session'
import { rateLimit } from '@/lib/rateLimit'
import { maxAuthSchema } from '@/lib/validation'

export async function POST(req: NextRequest) {
  const limited = rateLimit(req, { key: 'auth:max', limit: 10, windowMs: 60_000 })
  if (limited) return limited

  const appSecret = process.env.MAX_APP_SECRET
  if (!appSecret) {
    return NextResponse.json({ error: 'MAX app not configured' }, { status: 500 })
  }

  const parsed = maxAuthSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  }

  const contact = verifyMaxSharedContact(parsed.data, appSecret)
  if (!contact) {
    return NextResponse.json({ error: 'invalid_max_signature' }, { status: 401 })
  }

  const user = await upsertUser({
    platform: 'max',
    platformId: contact.id,
    displayName: maxDisplayName(contact),
    avatarUrl: contact.avatarUrl ?? null,
    phone: contact.phone
  })

  await createSessionCookie({ sub: user.id, platform: 'max', role: user.role, name: user.display_name })
  return NextResponse.json({ user })
}
