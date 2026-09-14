import L from 'leaflet'

// Fuel pump emblem for "Где бензин?" markers -- same visual language as the
// DPS badge (colored circle, white glyph, drop shadow) but green and with a
// gas-station-column icon instead of the car artwork.
const GAS_EMBLEM_SVG = `
<svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg" class="dps-emblem-icon">
  <circle cx="20" cy="20" r="19" fill="#16a34a" stroke="white" stroke-width="2"/>
  <g transform="translate(11,9)" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="0" y="2" width="11" height="18" rx="1.5"/>
    <rect x="2.5" y="5" width="6" height="4" rx="0.5"/>
    <path d="M11 8h2.5a2 2 0 0 1 2 2v6a1.5 1.5 0 0 0 3 0V7.5L16 5"/>
    <path d="M2 20h9"/>
  </g>
</svg>`

export function createGasIcon() {
  return L.divIcon({
    html: GAS_EMBLEM_SVG,
    className: '',
    iconSize: [40, 40],
    iconAnchor: [20, 20],
    popupAnchor: [0, -20]
  })
}
