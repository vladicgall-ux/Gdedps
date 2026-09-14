'use client'

import { createClient } from '@supabase/supabase-js'

// Browser client, anon key only -- used for read-only realtime/select calls.
// All writes go through /api/* routes so we can enforce auth + roles server-side.
export const supabaseBrowser = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  { auth: { persistSession: false } }
)
