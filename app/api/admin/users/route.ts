import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase/server'
import { getSession } from '@/lib/auth/session'

// GET: list all users for the admin panel.
export async function GET() {
  const session = await getSession()
  if (!session || session.role !== 'admin') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 })
  }

  const db = supabaseAdmin()
  const { data, error } = await db
    .from('app_users')
    .select('id, platform, platform_id, display_name, phone, role, created_at, last_seen_at')
    .order('last_seen_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data })
}
