import { useState } from 'react'
import { VENUES, VENUE_BY_ID } from '../data/master'
import {
  HOME_VENUE,
  buildItems,
  itemKey,
  LIVE_ONLY_TYPES,
  PLAN_KINDS,
  distanceKm,
  fromMin,
  toMin,
  walkMinutes,
  type PlanEvent,
  type PlanKind,
} from '../plan'
import type { Occurrence } from '../types'
import { SessionCard } from './SessionCard'
import { PlanTimeline } from './PlanTimeline'

type PlanApi = {
  events: PlanEvent[]
  add: (e: Omit<PlanEvent, 'id'>) => void
  update: (id: string, patch: Partial<PlanEvent>) => void
  remove: (id: string) => void
}

type Props = {
  day: string
  /** その日の★付きセッション */
  sessions: Occurrence[]
  plan: PlanApi
  starred: Set<string>
  onToggleStar: (id: string) => void
}

const TARGET_SESSIONS = 2
const TARGET_BLOGS = 2
const MIN_GAP = 45 // これ以上空いたら「空き時間」として出す（分）

const placeLabel = (place: string) => VENUE_BY_ID.get(place)?.label ?? place

function Move({ from, to, gap }: { from: string; to: string; gap: number | null }) {
  if (from === to) return null
  const km = distanceKm(from, to)
  if (km === null) return <div className="move">→ {placeLabel(to)} へ移動</div>
  const min = walkMinutes(km)
  const tight = gap !== null && gap < min
  return (
    <div className={`move${tight ? ' is-warn' : ''}`}>
      → {placeLabel(to)} へ 約 {km.toFixed(1)}km・徒歩 {min} 分目安
      {tight && <strong>（間が {gap} 分しかない）</strong>}
    </div>
  )
}

function EventForm({
  day,
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: {
  day: string
  initial?: PlanEvent
  onSubmit: (e: Omit<PlanEvent, 'id'>) => void
  onCancel?: () => void
  onDelete?: () => void
}) {
  const [kind, setKind] = useState<PlanKind>(initial?.kind ?? 'community')
  const [title, setTitle] = useState(initial?.title ?? '')
  const [start, setStart] = useState(initial?.start ?? '18:00')
  const [end, setEnd] = useState(initial?.end ?? '20:00')
  const isVenue = (p: string) => VENUE_BY_ID.has(p)
  const [placeSel, setPlaceSel] = useState(
    initial ? (isVenue(initial.place) ? initial.place : '__other') : HOME_VENUE,
  )
  const [placeText, setPlaceText] = useState(initial && !isVenue(initial.place) ? initial.place : '')

  return (
    <form
      className="plan-form"
      onSubmit={(e) => {
        e.preventDefault()
        if (toMin(end) <= toMin(start)) return
        onSubmit({
          date: initial?.date ?? day,
          kind,
          title: title.trim() || PLAN_KINDS[kind].label,
          start,
          end,
          place: placeSel === '__other' ? placeText.trim() || 'その他' : placeSel,
          tentative: false,
        })
        if (!initial) setTitle('')
      }}
    >
      <div className="row">
        <select value={kind} onChange={(e) => setKind(e.target.value as PlanKind)} aria-label="種類">
          {Object.entries(PLAN_KINDS).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <input
          className="grow"
          placeholder="例: Japan Night / Noodle Asia"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
      </div>
      <div className="row">
        <input type="time" value={start} onChange={(e) => setStart(e.target.value)} aria-label="開始" />
        〜
        <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} aria-label="終了" />
        <select value={placeSel} onChange={(e) => setPlaceSel(e.target.value)} aria-label="場所">
          {VENUES.map((v) => (
            <option key={v.id} value={v.id}>
              {v.label}
              {v.id === HOME_VENUE ? '（宿）' : ''}
            </option>
          ))}
          <option value="__other">その他（自由入力）</option>
        </select>
        {placeSel === '__other' && (
          <input className="grow" placeholder="場所" value={placeText} onChange={(e) => setPlaceText(e.target.value)} />
        )}
      </div>
      <div className="row">
        <button type="submit" className="pill is-active">
          {initial ? '更新' : '予定を追加'}
        </button>
        {onDelete && (
          <button type="button" className="link" onClick={onDelete}>
            削除
          </button>
        )}
        {onCancel && (
          <button type="button" className="link" onClick={onCancel}>
            キャンセル
          </button>
        )}
      </div>
    </form>
  )
}

export function PlanView({ day, sessions, plan, starred, onToggleStar }: Props) {
  const [editing, setEditing] = useState<string | null>(null)
  const [mode, setMode] = useState<'timeline' | 'list'>('timeline')
  const [selected, setSelected] = useState<string | null>(null)
  const items = buildItems(day, sessions, plan.events)

  const sessionCount = sessions.length
  const liveOnly = sessions.filter((o) => LIVE_ONLY_TYPES.has(o.session.type)).length
  const blogCount = plan.events.filter((e) => e.date === day && e.kind === 'blog').length
  const route = [HOME_VENUE, ...items.map((i) => i.place), HOME_VENUE]
  const totalKm = route.slice(1).reduce((sum, p, i) => sum + (distanceKm(route[i], p) ?? 0), 0)

  // 空き時間に予定を入れる。次の会場への徒歩ぶんを残し、長くても 2 時間に収める
  const quickAdd = (kind: PlanKind, free: { from: number; to: number; place: string; next: string }) => {
    const travel = walkMinutes(distanceKm(free.place, free.next) ?? 0)
    const end = Math.min(free.to - travel, free.from + 120)
    if (end - free.from < 15) return
    plan.add({
      date: day,
      kind,
      title: PLAN_KINDS[kind].label,
      start: fromMin(free.from),
      end: fromMin(end),
      place: free.place,
    })
  }

  // 各予定の直前に出す「空き時間」「重なり」「移動」を先に計算しておく
  type Row = { it: (typeof items)[number]; from: string; gap: number | null; free: { from: number; to: number; place: string; next: string } | null }
  const rows: Row[] = []
  let prevPlace = HOME_VENUE
  let prevEnd: number | null = null
  for (const it of items) {
    const gap: number | null = prevEnd === null ? null : it.start - prevEnd
    const free = prevEnd !== null && gap !== null && gap >= MIN_GAP ? { from: prevEnd, to: it.start, place: prevPlace, next: it.place } : null
    rows.push({ it, from: prevPlace, gap, free })
    prevPlace = it.place
    prevEnd = Math.max(prevEnd ?? 0, it.end)
  }
  const lastPlace = prevPlace
  const selectedItem = items.find((i) => itemKey(i) === selected) ?? null

  return (
    <div className="plan">
      <div className="plan-summary">
        <div className={sessionCount > TARGET_SESSIONS ? 'is-warn' : ''}>
          <b>
            {sessionCount}
            <span> 本</span>
          </b>
          <small>現地セッション（目安 1〜{TARGET_SESSIONS}）</small>
        </div>
        <div>
          <b>
            {liveOnly}
            <span> 本</span>
          </b>
          <small>うち録画なし形式</small>
        </div>
        <div className={blogCount < TARGET_BLOGS ? 'is-warn' : ''}>
          <b>
            {blogCount}
            <span> 枠</span>
          </b>
          <small>ブログ執筆（目標 {TARGET_BLOGS} 本）</small>
        </div>
        <div>
          <b>
            {totalKm.toFixed(1)}
            <span> km</span>
          </b>
          <small>移動（直線・宿起点）</small>
        </div>
      </div>

      <div className="seg" role="tablist" aria-label="表示">
        {(
          [
            ['timeline', '時間軸'],
            ['list', '一覧'],
          ] as const
        ).map(([m, label]) => (
          <button key={m} type="button" className={mode === m ? 'is-active' : ''} onClick={() => setMode(m)}>
            {label}
          </button>
        ))}
      </div>

      {mode === 'timeline' && (
        <>
          {selectedItem && (
            <div className="tl-detail">
              {selectedItem.type === 'session' ? (
                <SessionCard
                  occ={selectedItem.occ}
                  starred={starred.has(selectedItem.occ.session.id)}
                  onToggleStar={onToggleStar}
                />
              ) : (
                <EventForm
                  key={selectedItem.ev.id}
                  day={day}
                  initial={selectedItem.ev}
                  onSubmit={(e) => {
                    plan.update(selectedItem.ev.id, e)
                    setSelected(null)
                  }}
                  onCancel={() => setSelected(null)}
                  onDelete={() => {
                    plan.remove(selectedItem.ev.id)
                    setSelected(null)
                  }}
                />
              )}
            </div>
          )}
          <PlanTimeline items={items} selectedKey={selected} onSelect={setSelected} onQuickAdd={quickAdd} />
        </>
      )}

      {mode === 'list' && <div className="move move--home">宿（{placeLabel(HOME_VENUE)}）を出発</div>}

      {mode === 'list' && items.length === 0 && (
        <p className="empty">
          この日の予定はまだない。セッションの ☆ を押すか、下のフォームで予定を足してほしい。
        </p>
      )}

      {mode === 'list' && rows.map(({ it, from, gap, free }) => {
        const overlap = gap !== null && gap < 0
        const key = it.type === 'session' ? it.occ.key : it.ev.id

        return (
          <div key={key}>
            {free && (
              <div className="free">
                <span>
                  空き {fromMin(free.from)}–{fromMin(free.to)}（{free.to - free.from} 分）
                </span>
                {(['blog', 'community', 'swag'] as PlanKind[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    className="chip"
                    style={{ '--c': PLAN_KINDS[k].color } as React.CSSProperties}
                    onClick={() => quickAdd(k, free)}
                  >
                    + {PLAN_KINDS[k].label}
                  </button>
                ))}
              </div>
            )}
            {overlap && <div className="move is-warn">前の予定と {-gap!} 分重なっている</div>}
            <Move from={from} to={it.place} gap={overlap ? null : gap} />

            {it.type === 'session' ? (
              <SessionCard occ={it.occ} starred={starred.has(it.occ.session.id)} onToggleStar={onToggleStar} />
            ) : editing === it.ev.id ? (
              <EventForm
                day={day}
                initial={it.ev}
                onSubmit={(e) => {
                  plan.update(it.ev.id, e)
                  setEditing(null)
                }}
                onCancel={() => setEditing(null)}
              />
            ) : (
              <article
                className="card plan-event"
                style={{ '--c': PLAN_KINDS[it.ev.kind].color } as React.CSSProperties}
              >
                <div className="card__meta">
                  <span className="card__time">
                    {it.ev.start}–{it.ev.end}
                  </span>
                  <span className="badge plan-kind">{PLAN_KINDS[it.ev.kind].label}</span>
                  {it.ev.tentative && <span className="badge badge--warn">仮・公式未発表</span>}
                  <span className="plan-actions">
                    <button type="button" className="link" onClick={() => setEditing(it.ev.id)}>
                      編集
                    </button>
                    <button type="button" className="link" onClick={() => plan.remove(it.ev.id)}>
                      削除
                    </button>
                  </span>
                </div>
                <div className="card__title card__title--static">{it.ev.title}</div>
                <div className="card__venue">
                  <i style={{ background: VENUE_BY_ID.get(it.ev.place)?.color ?? '#888' }} />
                  {placeLabel(it.ev.place)}
                </div>
              </article>
            )}
          </div>
        )
      })}

      {mode === 'list' && items.length > 0 && <Move from={lastPlace} to={HOME_VENUE} gap={null} />}
      {mode === 'list' && items.length > 0 && <div className="move move--home">宿に戻る</div>}

      <h3 className="plan-form__title">予定を追加（交流会・ブログ・スワグ回収など）</h3>
      <EventForm key={day} day={day} onSubmit={plan.add} />
    </div>
  )
}
