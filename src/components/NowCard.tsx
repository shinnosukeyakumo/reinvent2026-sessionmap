import { useEffect, useState } from 'react'
import { DAYS, VENUE_BY_ID } from '../data/master'
import { TypeBadge } from './TypeBadge'
import { haversineKm, nowInVegas, type Position } from '../geo'
import { PLAN_KINDS, buildItems, fromMin, walkMinutes, type PlanEvent } from '../plan'
import type { Occurrence } from '../types'

type Props = {
  /** 選択中の日（会期外のときの表示に使う） */
  day: string
  starredAll: Occurrence[]
  events: PlanEvent[]
  geo: { enabled: boolean; pos: Position | null; error: string | null; toggle: (on: boolean) => void }
}

/** 地図アプリの徒歩ナビを開く URL。会場なら座標、そうでなければ名前で探させる */
function mapLinks(place: string) {
  const v = VENUE_BY_ID.get(place)
  const dest = v ? `${v.lat},${v.lng}` : `${place}, Las Vegas`
  return {
    google: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}&travelmode=walking`,
    apple: `https://maps.apple.com/?daddr=${encodeURIComponent(dest)}&dirflg=w`,
  }
}

export function NowCard({ day, starredAll, events, geo }: Props) {
  // 1 分ごとに描き直して、残り時間を更新する
  const [now, setNow] = useState(() => nowInVegas())
  useEffect(() => {
    const id = setInterval(() => setNow(nowInVegas()), 60_000)
    return () => clearInterval(id)
  }, [])

  const isEventDay = DAYS.some((d) => d.date === now.date)
  const targetDay = isEventDay ? now.date : day
  const items = buildItems(
    targetDay,
    starredAll.filter((o) => o.time.date === targetDay),
    events,
  )
  const next = isEventDay ? items.find((i) => i.end > now.minutes) : items[0]

  const venue = next ? VENUE_BY_ID.get(next.place) : undefined
  const km = geo.pos && venue ? haversineKm(geo.pos, venue) : null
  const walk = km !== null ? walkMinutes(km) : null
  const leaveAt = next && walk !== null ? next.start - walk : null
  const inProgress = isEventDay && next && next.start <= now.minutes
  const minutesLeft = isEventDay && leaveAt !== null ? leaveAt - now.minutes : null

  const title = next ? (next.type === 'session' ? `${next.occ.session.code} ${next.occ.session.title}` : next.ev.title) : ''
  const kind = next ? (next.type === 'session' ? next.occ.session.type : PLAN_KINDS[next.ev.kind].label) : ''
  const room = next?.type === 'session' ? next.occ.time.room : ''
  const links = next ? mapLinks(next.place) : null

  return (
    <section className="now">
      <header className="now__head">
        <b>{isEventDay ? (inProgress ? 'いまの予定' : '次の予定') : '次の行き先（当日の表示例）'}</b>
        <label className="toggle">
          <input type="checkbox" checked={geo.enabled} onChange={(e) => geo.toggle(e.target.checked)} />
          現在地を使う
        </label>
      </header>

      {!isEventDay && (
        <p className="now__note">会期中は、現地時刻で自動的に次の予定を出す。今は選んでいる日の最初の予定を表示している。</p>
      )}

      {!next ? (
        <p className="now__note">{isEventDay ? '今日の残りの予定はない。' : 'この日の予定はまだない。'}</p>
      ) : (
        <>
          <div className="now__main">
            <span className="now__time">
              {fromMin(next.start)}–{fromMin(next.end)}
            </span>
            {next.type === 'session' ? <TypeBadge type={next.occ.session.type} /> : <span className="badge">{kind}</span>}
          </div>
          <div className="now__title">{title}</div>
          <div className="now__place">
            <i style={{ background: venue?.color ?? '#888' }} />
            {venue?.label ?? next.place}
            {room && ` / ${room}`}
          </div>

          {geo.enabled && geo.error && <p className="now__warn">{geo.error}</p>}
          {geo.enabled && !geo.error && !geo.pos && <p className="now__note">現在地を取得している…</p>}
          {km !== null && walk !== null && leaveAt !== null && (
            <div className={`now__route${minutesLeft !== null && minutesLeft < 0 && !inProgress ? ' is-late' : ''}`}>
              ここから約 {km.toFixed(1)}km・徒歩 {walk} 分目安
              {!inProgress && (
                <>
                  ・<b>{fromMin(Math.max(0, leaveAt))} までに出発</b>
                  {minutesLeft !== null && (minutesLeft >= 0 ? `（あと ${minutesLeft} 分）` : `（${-minutesLeft} 分過ぎている）`)}
                </>
              )}
            </div>
          )}

          {links && (
            <div className="row">
              <a className="pill" href={links.google} target="_blank" rel="noreferrer">
                Google マップで経路
              </a>
              <a className="pill" href={links.apple} target="_blank" rel="noreferrer">
                Apple マップで経路
              </a>
            </div>
          )}
        </>
      )}
    </section>
  )
}
