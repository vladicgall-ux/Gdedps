import { supabaseAdmin } from '@/lib/supabase/server'
import type { AppUser, Platform } from '@/lib/types'

interface UpsertInput {
  platform: Platform
  platformId: string
  displayName?: string | null
  avatarUrl?: string | null
  phone?: string | null
}

// Creates the user on first sight, refreshes profile fields + last_seen_at
// on every subsequent login. The very first Telegram-platform admin can be
// promoted by hand in Supabase (set role='admin'); everyone else defaults
// to 'user'.
export async function upsertUser(input: UpsertInput): Promise<AppUser> {
  const db = supabaseAdmin()

  const { data: existing } = await db
    .from('app_users')
    .select('*')
    .eq('platform', input.platform)
    .eq('platform_id', input.platformId)
    .maybeSingle()

  if (existing) {
    const { data, error } = await db
      .from('app_users')
      .update({
        display_name: input.displayName ?? existing.display_name,
        avatar_url: input.avatarUrl ?? existing.avatar_url,
        phone: input.phone ?? existing.phone,
        last_seen_at: new Date().toISOString()
      })
      .eq('id', existing.id)
      .select('*')
      .single()

    if (error) throw error
    return data as AppUser
  }

  const { data, error } = await db
    .from('app_users')
    .insert({
      platform: input.platform,
      platform_id: input.platformId,
      display_name: input.displayName ?? null,
      avatar_url: input.avatarUrl ?? null,
      phone: input.phone ?? null
    })
    .select('*')
    .single()

  if (error) throw error
  return data as AppUser
}
