import { VENUE_BY_ID } from '../data/master'
import { HOME_VENUE, PLAN_KINDS, distanceKm, fromMin, itemKey, walkMinutes, type PlanItem, type PlanKind } from '../plan'

/** 1 分あたりの高さ（px）。60 分 = 72px */
const PX = 1.2
const MIN_FREE = 30 // これ以上の空きだけ「空き時間」として描く（分）

/** to は次の予定の開始時刻。描画では、そこから移動時間を引いた出発時刻までを空きとして塗る */
export type FreeSlot = { from: number; to: number; place: string; next: string; depart: number }

type Props = {
  items: PlanItem[]
  selectedKey: string | null
  onSelect: (key: string | null) => void
  onQuickAdd: (kind: PlanKind, free: FreeSlot) => void
}

const placeLabel = (place: string) => VENUE_BY_ID.get(place)?.label ?? place
const travelMin = (from: string, to: string) => {
  const km = from === to ? 0 : distanceKm(from, to)
  return km ? walkMinutes(km) : 0
}

/** 時間が重なる予定を横に並べるため、各予定に列番号と、その重なりの塊での列数を振る */
function assignLanes(items: PlanItem[]) {
  const lanes = new Map<PlanItem, { lane: number; of: number }>()
  let cluster: PlanItem[] = []
  let clusterEnd = -1
  const laneEnds: number[] = []
  const flush = () => {
    const of = Math.max(1, ...cluster.map((c) => lanes.get(c)!.lane + 1))
    for (const c of cluster) lanes.get(c)!.of = of
    cluster = []
    laneEnds.length = 0
  }
  for (const it of items) {
    if (it.start >= clusterEnd && cluster.length) flush()
    let lane = laneEnds.findIndex((end) => end <= it.start)
    if (lane === -1) lane = laneEnds.length
    laneEnds[lane] = it.end
    lanes.set(it, { lane, of: 1 })
    cluster.push(it)
    clusterEnd = Math.max(clusterEnd, it.end)
  }
  if (cluster.length) flush()
  return lanes
}

export function PlanTimeline({ items, selectedKey, onSelect, onQuickAdd }: Props) {
  // 予定どうしの間にある「移動」と「空き」を先に計算する。移動は到着時刻から逆算して置く
  type Travel = { from: number; to: number; dest: string; minutes: number; late: boolean }
  const travels: Travel[] = []
  const frees: FreeSlot[] = []
  let prevPlace = HOME_VENUE
  let prevEnd: number | null = null
  for (const it of items) {
    const minutes = travelMin(prevPlace, it.place)
    const depart = it.start - minutes
    if (minutes > 0) travels.push({ from: depart, to: it.start, dest: it.place, minutes, late: prevEnd !== null && prevEnd > depart })
    if (prevEnd !== null && depart - prevEnd >= MIN_FREE)
      frees.push({ from: prevEnd, to: it.start, place: prevPlace, next: it.place, depart })
    prevPlace = it.place
    prevEnd = Math.max(prevEnd ?? 0, it.end)
  }
  if (prevEnd !== null) {
    const minutes = travelMin(prevPlace, HOME_VENUE)
    if (minutes > 0) travels.push({ from: prevEnd, to: prevEnd + minutes, dest: HOME_VENUE, minutes, late: false })
  }

  // 表示範囲は予定の前後を含む「時」単位。予定が無ければ 8〜18 時
  const starts = [...items.map((i) => i.start), ...travels.map((t) => t.from)]
  const ends = [...items.map((i) => i.end), ...travels.map((t) => t.to)]
  const rangeStart = Math.floor(Math.min(8 * 60, ...starts) / 60) * 60
  const rangeEnd = Math.min(24 * 60, Math.ceil(Math.max(18 * 60, ...ends) / 60) * 60)
  const y = (min: number) => (min - rangeStart) * PX
  const hours = Array.from({ length: (rangeEnd - rangeStart) / 60 + 1 }, (_, i) => rangeStart + i * 60)
  const lanes = assignLanes(items)

  return (
    <div className="tl" style={{ height: (rangeEnd - rangeStart) * PX + 16 }}>
      {hours.map((h) => (
        <div key={h} className="tl__hour" style={{ top: y(h) }}>
          <span>{fromMin(h)}</span>
        </div>
      ))}

      <div className="tl__body">
        {frees.map((f) => (
          <div key={`free-${f.from}`} className="tl__free" style={{ top: y(f.from), height: (f.depart - f.from) * PX }}>
            <span>
              空き {fromMin(f.from)}–{fromMin(f.depart)}（{f.depart - f.from} 分）
            </span>
            <span className="tl__quick">
              {(['blog', 'community', 'swag'] as PlanKind[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  className="chip"
                  style={{ '--c': PLAN_KINDS[k].color } as React.CSSProperties}
                  onClick={() => onQuickAdd(k, f)}
                >
                  + {PLAN_KINDS[k].label}
                </button>
              ))}
            </span>
          </div>
        ))}

        {travels.map((t) => (
          <div
            key={`travel-${t.from}-${t.dest}`}
            className={`tl__travel${t.late ? ' is-warn' : ''}`}
            style={{ top: y(t.from), height: t.minutes * PX }}
            title={`${placeLabel(t.dest)} へ徒歩 ${t.minutes} 分目安`}
          >
            → {t.dest === HOME_VENUE ? '宿' : placeLabel(t.dest)} 徒歩 {t.minutes} 分{t.late && '（間に合わない）'}
          </div>
        ))}

        {items.map((it) => {
          const key = itemKey(it)
          const { lane, of } = lanes.get(it)!
          const height = Math.max((it.end - it.start) * PX, 24)
          const color =
            it.type === 'session' ? VENUE_BY_ID.get(it.place)?.color ?? '#888' : PLAN_KINDS[it.ev.kind].color
          const label = it.type === 'session' ? it.occ.session.type : PLAN_KINDS[it.ev.kind].label
          const title = it.type === 'session' ? it.occ.session.title : it.ev.title
          const code = it.type === 'session' ? it.occ.session.code : null
          const room = it.type === 'session' ? it.occ.time.room : ''
          return (
            <button
              key={key}
              type="button"
              className={`tl__item tl__item--${it.type}${selectedKey === key ? ' is-selected' : ''}${height < 50 ? ' is-short' : ''}`}
              style={
                {
                  top: y(it.start),
                  height,
                  left: `calc(${(lane / of) * 100}% + 2px)`,
                  width: `calc(${100 / of}% - 4px)`,
                  '--c': color,
                } as React.CSSProperties
              }
              onClick={() => onSelect(selectedKey === key ? null : key)}
            >
              <span className="tl__meta">
                {fromMin(it.start)}–{fromMin(it.end)} · {label}
                {code && <b> {code}</b>}
              </span>
              <span className="tl__title">{title}</span>
              <span className="tl__place">
                {placeLabel(it.place)}
                {room && ` / ${room}`}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
