export type Platform = 'telegram' | 'vk' | 'max' | 'web'
export type Role = 'user' | 'admin'
export type MarkerKind = 'dps' | 'gas'

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
  kind: MarkerKind
  // 'user' -- a temporary report placed by someone in the app (expires in 3h
  // unless confirmed). 'osm' -- a permanent gas station seeded from
  // OpenStreetMap open data; it never expires, only its price/comments do.
  source: 'user' | 'osm'
  lat: number
  lng: number
  note: string | null
  price92: number | null
  price95: number | null
  priceDt: number | null
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
