import { createClient } from '@supabase/supabase-js'

// Server-only client using the service-role key. Never import this file
// from a client component -- it bypasses Row Level Security entirely.
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !key) {
    throw new Error('Supabase server env vars are missing (NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false }
  })
}
