/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Modern browsers honor CSP's frame-ancestors over X-Frame-Options,
          // so we rely on frame-ancestors alone (scoped to TG/VK/MAX + self)
          // rather than emitting a legacy header that can't express an
          // allowlist -- there is deliberately no wildcard here.
          {
            key: 'Content-Security-Policy',
            value:
              "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org https://vk.com https://*.vk.com https://*.max.ru https://max.ru;"
          },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'geolocation=(self), camera=(), microphone=()' }
        ]
      }
    ]
  }
}

export default nextConfig
