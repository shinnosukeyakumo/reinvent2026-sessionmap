import { useEffect, useMemo } from 'react'
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { VENUES, VENUE_BY_ID, topicOf, type Venue } from '../data/master'
import { HOME_VENUE } from '../plan'
import type { Occurrence } from '../types'

type Props = {
  occurrences: Occurrence[]
  selectedVenue: string | null
  onSelectVenue: (id: string | null) => void
  /** マイプランで回る会場の順番（宿→…→宿） */
  route?: string[]
}

// 全会場が収まる範囲で初期表示する
const BOUNDS = L.latLngBounds(VENUES.map((v) => [v.lat, v.lng] as L.LatLngTuple))

/** トピック構成比を conic-gradient のドーナツで描くマーカー */
function venueIcon(venue: Venue, occ: Occurrence[], selected: boolean) {
  const counts = new Map<string, { color: string; n: number }>()
  for (const o of occ) {
    const t = topicOf(o.session.topics[0])
    const c = counts.get(t.label) ?? { color: t.color, n: 0 }
    c.n += 1
    counts.set(t.label, c)
  }
  const total = occ.length
  let acc = 0
  const stops = [...counts.values()]
    .sort((a, b) => b.n - a.n)
    .map(({ color, n }) => {
      const from = (acc / total) * 360
      acc += n
      return `${color} ${from}deg ${(acc / total) * 360}deg`
    })
  const ring = total ? `conic-gradient(${stops.join(',')})` : 'var(--ring-empty)'
  const size = Math.round(38 + Math.min(total, 200) * 0.1) + (selected ? 8 : 0)

  return L.divIcon({
    className: '',
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    html: `
      <div class="venue-marker${selected ? ' is-selected' : ''}${total ? '' : ' is-empty'}${venue.id === HOME_VENUE ? ' is-home' : ''}"
           style="--size:${size}px;--ring:${ring};--venue:${venue.color}">
        <div class="venue-marker__hole"><span>${total}</span></div>
        <div class="venue-marker__label">${venue.label}${venue.id === HOME_VENUE ? '（宿）' : ''}</div>
      </div>`,
  })
}

function FlyToSelected({ selectedVenue }: { selectedVenue: string | null }) {
  const map = useMap()
  useEffect(() => {
    const v = VENUES.find((x) => x.id === selectedVenue)
    if (v) map.flyTo([v.lat, v.lng], Math.max(map.getZoom(), 15), { duration: 0.6 })
  }, [selectedVenue, map])
  return null
}

/** マイプランのルートが変わったら、ルート全体が見える範囲に寄せる */
function FitRoute({ route }: { route: string[] }) {
  const map = useMap()
  // route 配列は描画のたびに作り直されるため、中身の文字列で変化を判定する
  const keyOf = route.join('>')
  useEffect(() => {
    const pts = keyOf
      .split('>')
      .map((id) => VENUE_BY_ID.get(id))
      .filter((v): v is Venue => !!v)
    if (pts.length > 2) map.flyToBounds(L.latLngBounds(pts.map((v) => [v.lat, v.lng] as L.LatLngTuple)), { padding: [60, 60], duration: 0.6 })
  }, [keyOf, map])
  return null
}

export function MapView({ occurrences, selectedVenue, onSelectVenue, route = [] }: Props) {
  const byVenue = useMemo(() => {
    const m = new Map<string, Occurrence[]>()
    for (const o of occurrences) {
      const list = m.get(o.time.venue) ?? []
      list.push(o)
      m.set(o.time.venue, list)
    }
    return m
  }, [occurrences])

  return (
    <MapContainer bounds={BOUNDS}
      boundsOptions={{ padding: [60, 60] }}
      className="map" zoomControl={false}>
      <TileLayer
        // OSM 標準タイル（API キー不要）。暗色化は CSS フィルターで行う
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="tiles-dark"
        maxZoom={19}
      />
      <FlyToSelected selectedVenue={selectedVenue} />
      <FitRoute route={route} />
      {route.length > 2 && (
        <Polyline
          positions={route
            .map((id) => VENUE_BY_ID.get(id))
            .filter((v): v is Venue => !!v)
            .map((v) => [v.lat, v.lng] as L.LatLngTuple)}
          pathOptions={{ color: '#ff6ec7', weight: 4, dashArray: '8 8', opacity: 0.9 }}
        />
      )}
      {VENUES.map((v) => {
        const occ = byVenue.get(v.id) ?? []
        const selected = selectedVenue === v.id
        return (
          <Marker
            key={v.id}
            position={[v.lat, v.lng]}
            icon={venueIcon(v, occ, selected)}
            zIndexOffset={selected ? 1000 : 0}
            eventHandlers={{ click: () => onSelectVenue(selected ? null : v.id) }}
          >
            <Tooltip direction="top" offset={[0, -24]}>
              <strong>{v.label}</strong>
              <br />
              {v.note}
              <br />
              表示中のセッション: {occ.length} 件
            </Tooltip>
          </Marker>
        )
      })}
    </MapContainer>
  )
}
