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
type VkExchangeResult =
  | { ok: true; id: string; firstName?: string; lastName?: string; avatarUrl?: string; phone?: string }
  | { ok: false; error: string }

export async function exchangeVkIdCode(params: {
  code: string
  codeVerifier: string
  deviceId: string
  redirectUri: string
  state: string
  appId: string
}): Promise<VkExchangeResult> {
  // VK ID's OAuth 2.1 + PKCE flow authenticates the token exchange with
  // code_verifier, not a client_secret -- a secret would defeat the point of
  // PKCE for a public client. `state` must also be echoed back here (not
  // just checked client-side) or VK rejects the exchange.
  const tokenResp = await fetch('https://id.vk.com/oauth2/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      code_verifier: params.codeVerifier,
      device_id: params.deviceId,
      redirect_uri: params.redirectUri,
      state: params.state,
      client_id: params.appId
    })
  })

  if (!tokenResp.ok) {
    const detail = await tokenResp.text()
    console.error('VK ID token exchange failed', tokenResp.status, detail)
    return { ok: false, error: `token_exchange_${tokenResp.status}: ${detail.slice(0, 300)}` }
  }
  const tokenJson = (await tokenResp.json()) as { access_token?: string; user_id?: number }
  if (!tokenJson.access_token || !tokenJson.user_id) {
    console.error('VK ID token exchange returned no access_token/user_id', tokenJson)
    return { ok: false, error: `token_exchange_missing_fields: ${JSON.stringify(tokenJson).slice(0, 300)}` }
  }

  const infoResp = await fetch('https://id.vk.com/oauth2/user_info', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ access_token: tokenJson.access_token, client_id: params.appId })
  })
  if (!infoResp.ok) {
    const detail = await infoResp.text()
    console.error('VK ID user_info failed', infoResp.status, detail)
    return { ok: false, error: `user_info_${infoResp.status}: ${detail.slice(0, 300)}` }
  }
  const info = (await infoResp.json()) as {
    user?: { first_name?: string; last_name?: string; avatar?: string; phone?: string }
  }

  return {
    ok: true,
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
