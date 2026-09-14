import L from 'leaflet'

// Simple "DPS patrol car" emblem, drawn as inline SVG so no image assets are needed.
export const DPS_EMBLEM_SVG = `
<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" class="dps-emblem-icon">
  <circle cx="20" cy="20" r="19" fill="#1d4ed8" stroke="white" stroke-width="2"/>
  <g transform="translate(6,12)">
    <rect x="0" y="6" width="28" height="9" rx="2.5" fill="white"/>
    <rect x="3" y="1" width="22" height="7" rx="2" fill="white"/>
    <rect x="6" y="2.5" width="16" height="4" rx="1" fill="#1d4ed8"/>
    <circle cx="6" cy="16" r="3.2" fill="#0f172a"/>
    <circle cx="22" cy="16" r="3.2" fill="#0f172a"/>
    <rect x="0" y="8.5" width="4" height="3" fill="#ef4444"/>
    <rect x="24" y="8.5" width="4" height="3" fill="#3b82f6"/>
  </g>
</svg>`

export function createDpsIcon() {
  return L.divIcon({
    html: DPS_EMBLEM_SVG,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  })
}

export function createUserDotIcon() {
  return L.divIcon({
    html: '<div class="dps-user-dot"></div>',
    className: '',
    iconSize: [16, 16],
    iconAnchor: [8, 8]
  })
}
