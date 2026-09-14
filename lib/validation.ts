import { z } from 'zod'

// --- Auth payloads -----------------------------------------------------

export const telegramAuthSchema = z.union([
  z.object({ initData: z.string().min(1).max(4096) }),
  z
    .object({
      id: z.union([z.string(), z.number()]),
      auth_date: z.union([z.string(), z.number()]),
      hash: z.string().min(1),
      first_name: z.string().optional(),
      last_name: z.string().optional(),
      username: z.string().optional(),
      photo_url: z.string().url().optional()
    })
    .passthrough()
])

export const maxAuthSchema = z
  .object({
    id: z.string().min(1).max(128),
    phone: z.string().min(1).max(32),
    ts: z.number(),
    sign: z.string().min(1),
    first_name: z.string().max(200).optional(),
    last_name: z.string().max(200).optional(),
    avatar_url: z.string().url().optional()
  })
  .passthrough()

export const telegramLoginCodeSchema = z.object({
  code: z.string().regex(/^\d{6}$/, 'must be a 6-digit code')
})

// --- Marker payloads -----------------------------------------------------

export const markerCreateSchema = z.object({
  lat: z.number().gte(-90).lte(90),
  lng: z.number().gte(-180).lte(180),
  kind: z.enum(['dps', 'gas']).default('dps'),
  note: z.string().trim().max(500).optional().nullable()
})

export const markerKindQuerySchema = z.enum(['dps', 'gas']).default('dps')

export const commentCreateSchema = z.object({
  body: z.string().trim().min(1).max(500)
})

// --- Admin payloads --------------------------------------------------------

export const adminRoleUpdateSchema = z.object({
  role: z.enum(['user', 'admin'])
})
