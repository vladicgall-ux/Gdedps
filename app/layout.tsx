import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import './globals.css'
import { AuthProvider } from '@/components/AuthProvider'

export const metadata: Metadata = {
  title: 'Где ДПС?',
  description: 'Карта постов ДПС в реальном времени от сообщества — Telegram, VK, MAX и веб',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Где ДПС?'
  }
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0f172a' }
  ]
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>
        {/* Required for window.Telegram.WebApp (and initData) to exist at all
            when the page is opened inside a Telegram Mini App -- without this
            script Telegram never injects the object, so auto-login never runs. */}
        <Script src="https://telegram.org/js/telegram-web-app.js" strategy="beforeInteractive" />
        {/* VK Bridge -- required inside a VK Mini App to send VKWebAppInit,
            which tells VK the app has loaded. Without it VK shows its own
            loading spinner over the page forever instead of displaying it. */}
        <Script src="https://unpkg.com/@vkontakte/vk-bridge/dist/browser.min.js" strategy="beforeInteractive" />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
