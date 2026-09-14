import L from 'leaflet'

// DPS patrol car emblem -- custom artwork, served from public/dps-marker.png.
export function createDpsIcon() {
  return L.icon({
    iconUrl: '/dps-marker.png',
    className: 'dps-emblem-icon',
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
