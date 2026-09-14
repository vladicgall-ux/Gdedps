import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1d4ed8'
        }}
      >
        <svg width={124} height={124} viewBox="0 0 28 15" xmlns="http://www.w3.org/2000/svg">
          <rect x="0" y="6" width="28" height="9" rx="2.5" fill="white" />
          <rect x="3" y="1" width="22" height="7" rx="2" fill="white" />
          <rect x="6" y="2.5" width="16" height="4" rx="1" fill="#1d4ed8" />
          <circle cx="6" cy="16" r="3.2" fill="#0f172a" />
          <circle cx="22" cy="16" r="3.2" fill="#0f172a" />
          <rect x="0" y="8.5" width="4" height="3" fill="#ef4444" />
          <rect x="24" y="8.5" width="4" height="3" fill="#3b82f6" />
        </svg>
      </div>
    ),
    { ...size }
  )
}
