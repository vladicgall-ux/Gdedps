import { NextRequest, NextResponse } from 'next/server'
import { verifyVkLaunchParams, exchangeVkIdCode, vkDisplayName } from '@/lib/auth/vk'
import { upsertUser } from '@/lib/auth/upsertUser'
import { createSessionCookie } from '@/lib/auth/session'

export async function POST(req: NextRequest) {
  const appId = process.env.NEXT_PUBLIC_VK_APP_ID
  const appSecret = process.env.VK_APP_SECRET
  if (!appId || !appSecret) {
    return NextResponse.json({ error: 'VK app not configured' }, { status: 500 })
  }

  const body = await req.json()

  // Path 1: VK Mini App launch params (VK Bridge)
  if (body.launchParams) {
    const vkUser = verifyVkLaunchParams(body.launchParams as string, appSecret)
    if (!vkUser) return NextResponse.json({ error: 'invalid_vk_signature' }, { status: 401 })

    const user = await upsertUser({
      platform: 'vk',
      platformId: String(vkUser.id),
      displayName: body.firstName || body.lastName ? `${body.firstName ?? ''} ${body.lastName ?? ''}`.trim() : null,
      avatarUrl: body.photoUrl ?? null
    })

    await createSessionCookie({ sub: user.id, platform: 'vk', role: user.role, name: user.display_name })
    return NextResponse.json({ user })
  }

  // Path 2: VK ID web login (authorization code + PKCE)
  if (body.code && body.codeVerifier && body.deviceId && body.redirectUri) {
    const vkUser = await exchangeVkIdCode({
      code: body.code,
      codeVerifier: body.codeVerifier,
      deviceId: body.deviceId,
      redirectUri: body.redirectUri,
      appId,
      appSecret
    })
    if (!vkUser) return NextResponse.json({ error: 'vk_id_exchange_failed' }, { status: 401 })

    const user = await upsertUser({
      platform: 'vk',
      platformId: vkUser.id,
      displayName: vkDisplayName(vkUser),
      avatarUrl: vkUser.avatarUrl ?? null,
      phone: vkUser.phone ?? null
    })

    await createSessionCookie({ sub: user.id, platform: 'vk', role: user.role, name: user.display_name })
    return NextResponse.json({ user })
  }

  return NextResponse.json({ error: 'missing_params' }, { status: 400 })
}
