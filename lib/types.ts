export type Platform = 'telegram' | 'vk' | 'max' | 'web'
export type Role = 'user' | 'admin'

export interface AppUser {
  id: string
  platform: Platform
  platform_id: string
  display_name: string | null
  avatar_url: string | null
  phone: string | null
  role: Role
  created_at: string
  last_seen_at: string
}

export interface DpsMarker {
  id: string
  author_id: string | null
  lat: number
  lng: number
  note: string | null
  created_at: string
  expires_at: string
  confirmations_count: number
  comments?: DpsMarkerComment[]
  author_name?: string | null
}

export interface DpsMarkerComment {
  id: string
  marker_id: string
  author_id: string | null
  body: string
  created_at: string
  author_name?: string | null
}

export interface SessionPayload {
  sub: string
  platform: Platform
  role: Role
  name: string | null
}
