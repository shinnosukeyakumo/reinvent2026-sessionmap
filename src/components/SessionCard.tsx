import { useState } from 'react'
import { VENUE_BY_ID, topicOf } from '../data/master'
import { HOME_VENUE, distanceKm } from '../plan'
import type { Occurrence } from '../types'

type Props = {
  occ: Occurrence
  starred: boolean
  onToggleStar: (id: string) => void
  /** 会場別ビューでは会場名を省く、などの出し分け */
  hide?: { time?: boolean; venue?: boolean }
}

const CATALOG_URL =
  'https://registration.awsevents.com/flow/awsevents/reinvent2026/eventcatalog/page/eventcatalog'

export function SessionCard({ occ, starred, onToggleStar, hide = {} }: Props) {
  const [open, setOpen] = useState(false)
  const { session: s, time: t } = occ
  const venue = VENUE_BY_ID.get(t.venue)
  const km = t.venue === HOME_VENUE ? null : distanceKm(HOME_VENUE, t.venue)

  return (
    <article className={`card${open ? ' is-open' : ''}`}>
      <div className="card__meta">
        {!hide.time && (
          <span className="card__time">
            {t.start}–{t.end}
          </span>
        )}
        {s.isNew && <span className="badge badge--new">NEW</span>}
        <span className="card__code">{s.code}</span>
        <span className="badge">{s.type}</span>
        {s.level && <span className="badge badge--muted">{s.level.split(' ')[0]}</span>}
        <button
          type="button"
          className={`star${starred ? ' is-on' : ''}`}
          aria-label={starred ? 'お気に入りから外す' : 'お気に入りに追加'}
          onClick={() => onToggleStar(s.id)}
        >
          {starred ? '★' : '☆'}
        </button>
      </div>
      <button type="button" className="card__title" onClick={() => setOpen((v) => !v)}>
        {s.title}
      </button>
      {!hide.venue && (
        <div className="card__venue">
          <i style={{ background: venue?.color ?? '#888' }} />
          {venue?.label ?? t.venue}
          {t.room && <span className="card__room"> / {t.room}</span>}
          {km !== null && <span className="card__dist">宿から {km.toFixed(1)}km</span>}
        </div>
      )}
      {hide.venue && t.room && <div className="card__venue card__room">{t.room}</div>}
      <div className="card__topics">
        {s.topics.map((id) => {
          const tp = topicOf(id)
          return (
            <span key={id} className="chip chip--static" style={{ '--c': tp.color } as React.CSSProperties}>
              {tp.label}
            </span>
          )
        })}
      </div>
      {open && (
        <div className="card__detail">
          <p>{s.abstract}</p>
          {s.speakers.length > 0 && <p className="card__speakers">登壇: {s.speakers.join(', ')}</p>}
          <a href={CATALOG_URL} target="_blank" rel="noreferrer">
            公式カタログで {s.code} を探す ↗
          </a>
        </div>
      )}
    </article>
  )
}
