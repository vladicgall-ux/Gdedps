import { NextRequest, NextResponse } from 'next/server'
import { verifyMaxSharedContact, maxDisplayName } from '@/lib/auth/max'
import { upsertUser } from '@/lib/auth/upsertUser'
import { createSessionCookie } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  const appSecret = process.env.MAX_APP_SECRET
  if (!appSecret) {
    return NextResponse.json({ error: 'MAX app not configured' }, { status: 500 })
  }

  const body = await req.json()
  const contact = verifyMaxSharedContact(body, appSecret)
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
