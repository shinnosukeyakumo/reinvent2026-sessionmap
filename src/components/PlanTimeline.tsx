import { useRef, useState } from 'react'
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
  /** 選択中の部品（スマホのタップ配置用） */
  armed: PlanKind | null
  onPlace: (kind: PlanKind, startMin: number) => void
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

export function PlanTimeline({ items, selectedKey, onSelect, armed, onPlace }: Props) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const [guide, setGuide] = useState<number | null>(null)

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
  /** 画面上の縦位置を、15 分刻みの時刻に直す */
  const minuteAt = (clientY: number) => {
    const top = bodyRef.current?.getBoundingClientRect().top ?? 0
    const raw = rangeStart + (clientY - top) / PX
    return Math.min(Math.max(Math.round(raw / 15) * 15, rangeStart), rangeEnd - 15)
  }

  return (
    <div className="tl" style={{ height: (rangeEnd - rangeStart) * PX + 16 }}>
      {hours.map((h) => (
        <div key={h} className="tl__hour" style={{ top: y(h) }}>
          <span>{fromMin(h)}</span>
        </div>
      ))}

      <div
        ref={bodyRef}
        className={`tl__body${armed ? ' is-armed' : ''}`}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes('text/plan-kind')) return
          e.preventDefault()
          e.dataTransfer.dropEffect = 'copy'
          setGuide(minuteAt(e.clientY))
        }}
        onDragLeave={() => setGuide(null)}
        onDrop={(e) => {
          const kind = e.dataTransfer.getData('text/plan-kind') as PlanKind
          setGuide(null)
          if (!kind) return
          e.preventDefault()
          onPlace(kind, minuteAt(e.clientY))
        }}
        onMouseMove={(e) => armed && setGuide(minuteAt(e.clientY))}
        onMouseLeave={() => armed && setGuide(null)}
        onClick={(e) => {
          if (!armed) return
          onPlace(armed, minuteAt(e.clientY))
          setGuide(null)
        }}
      >
        {guide !== null && (
          <div className="tl__guide" style={{ top: y(guide) }}>
            <span>{fromMin(guide)}</span>
          </div>
        )}
        {frees.map((f) => (
          <div key={`free-${f.from}`} className="tl__free" style={{ top: y(f.from), height: (f.depart - f.from) * PX }}>
            <span>
              空き {fromMin(f.from)}–{fromMin(f.depart)}（{f.depart - f.from} 分）
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
              onClick={(e) => {
                // 配置モード中は、予定の上をタップしてもその時刻に置く
                if (armed) return
                e.stopPropagation()
                onSelect(selectedKey === key ? null : key)
              }}
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
