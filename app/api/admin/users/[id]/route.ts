import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'
import { rateLimit } from '@/lib/rateLimit'
import { adminRoleUpdateSchema } from '@/lib/validation'

// PATCH: promote/demote a user's role. Admin-only.
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const limited = rateLimit(req, { key: `admin:users:role:${session.sub}`, limit: 30, windowMs: 60_000 })
  if (limited) return limited

  const parsed = adminRoleUpdateSchema.safeParse(await req.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_payload' }, { status: 400 })
  }

  // Don't let an admin lock themselves out by demoting their own account.
  if (params.id === session.sub && parsed.data.role !== 'admin') {
    return NextResponse.json({ error: 'cannot_demote_self' }, { status: 400 })
  }

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('app_users')
    .update({ role: parsed.data.role })
    .eq('id', params.id)
    .select('id, platform, platform_id, display_name, phone, role, created_at, last_seen_at')
    .maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'not_found' }, { status: 404 })

  return NextResponse.json({ user: data })
}
