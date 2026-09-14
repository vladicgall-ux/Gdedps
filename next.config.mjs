/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        // Allow embedding inside Telegram / VK / MAX mini-app webviews.
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options', value: 'ALLOWALL' },
          {
            key: 'Content-Security-Policy',
            value:
              "frame-ancestors 'self' https://web.telegram.org https://*.telegram.org https://vk.com https://*.vk.com https://*.max.ru https://max.ru;"
          }
        ]
      }
    ]
  }
}

export default nextConfig
