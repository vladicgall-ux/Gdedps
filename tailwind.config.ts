import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#b3ccff',
          300: '#80abff',
          400: '#4d84ff',
          500: '#2563eb',
          600: '#1d4ed8',
          700: '#1e40af',
          800: '#1e3a8a',
          900: '#172554'
        }
      },
      spacing: {
        // See --app-safe-top/bottom in globals.css -- these fold in
        // Telegram Mini App's own fullscreen safe-area variables too.
        'safe-top': 'var(--app-safe-top)',
        'safe-bottom': 'var(--app-safe-bottom)',
        'safe-left': 'env(safe-area-inset-left)',
        'safe-right': 'env(safe-area-inset-right)'
      }
    }
  },
  plugins: []
}

export default config
