import { createHmac } from 'node:crypto'

interface VkLaunchUser {
  id: number
  firstName?: string
  lastName?: string
  photoUrl?: string
}

/**
 * Verifies `vk_*` launch params passed to a VK Mini App (VK Bridge).
 * https://dev.vk.com/mini-apps/development/launch-params
 */
export function verifyVkLaunchParams(search: string, appSecret: string): VkLaunchUser | null {
  const params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search)
  const sign = params.get('sign')
  if (!sign) return null

  const vkParams = [...params.entries()]
    .filter(([key]) => key.startsWith('vk_'))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&')

  const computed = createHmac('sha256', appSecret)
    .update(vkParams)
    .digest('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

  if (computed !== sign) return null

  const userId = Number(params.get('vk_user_id'))
  if (!userId) return null

  return { id: userId }
}

/**
 * Exchanges a VK ID authorization code (PKCE flow, web login button) for a
 * user profile. See https://id.vk.com/about/business/go/docs/vkid/latest/vk-id/connection/api-integration/auth-flow
 */
export async function exchangeVkIdCode(params: {
  code: string
  codeVerifier: string
  deviceId: string
  redirectUri: string
  appId: string
  appSecret: string
}): Promise<{ id: string; firstName?: string; lastName?: string; avatarUrl?: string; phone?: string } | null> {
  const tokenResp = await fetch('https://id.vk.com/oauth2/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      code_verifier: params.codeVerifier,
      device_id: params.deviceId,
      redirect_uri: params.redirectUri,
      client_id: params.appId,
      client_secret: params.appSecret
    })
  })

  if (!tokenResp.ok) return null
  const tokenJson = (await tokenResp.json()) as { access_token?: string; user_id?: number }
  if (!tokenJson.access_token || !tokenJson.user_id) return null

  const infoResp = await fetch('https://id.vk.com/oauth2/user_info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ access_token: tokenJson.access_token, client_id: params.appId })
  })
  if (!infoResp.ok) return null
  const info = (await infoResp.json()) as {
    user?: { first_name?: string; last_name?: string; avatar?: string; phone?: string }
  }

  return {
    id: String(tokenJson.user_id),
    firstName: info.user?.first_name,
    lastName: info.user?.last_name,
    avatarUrl: info.user?.avatar,
    phone: info.user?.phone
  }
}

export function vkDisplayName(user: { firstName?: string; lastName?: string; id: number | string }) {
  return [user.firstName, user.lastName].filter(Boolean).join(' ') || `vk${user.id}`
}
