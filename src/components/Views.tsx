import { useEffect, useRef } from 'react'
import { TOPICS, VENUES, VENUE_BY_ID, topicOf } from '../data/master'
import type { Occurrence } from '../types'
import { SessionCard } from './SessionCard'

type CommonProps = {
  occurrences: Occurrence[]
  starred: Set<string>
  onToggleStar: (id: string) => void
}

const byStart = (a: Occurrence, b: Occurrence) =>
  a.time.start.localeCompare(b.time.start) || a.session.code.localeCompare(b.session.code)

function groupBy<K>(list: Occurrence[], key: (o: Occurrence) => K) {
  const m = new Map<K, Occurrence[]>()
  for (const o of list) {
    const k = key(o)
    const arr = m.get(k) ?? []
    arr.push(o)
    m.set(k, arr)
  }
  return m
}

/** 内訳を横棒で示す（会場ヘッダーならトピック内訳、トピックヘッダーなら会場内訳） */
function MixBar({ parts }: { parts: { color: string; n: number; label: string }[] }) {
  const total = parts.reduce((s, p) => s + p.n, 0)
  if (!total) return null
  return (
    <div className="mixbar" aria-hidden>
      {parts
        .filter((p) => p.n)
        .sort((a, b) => b.n - a.n)
        .map((p) => (
          <span key={p.label} title={`${p.label}: ${p.n}`} style={{ flex: p.n, background: p.color }} />
        ))}
    </div>
  )
}

function Empty() {
  return <p className="empty">条件に合うセッションがない。フィルターを緩めてほしい。</p>
}

export function VenueView({
  occurrences,
  starred,
  onToggleStar,
  selectedVenue,
}: CommonProps & { selectedVenue: string | null }) {
  const refs = useRef(new Map<string, HTMLElement>())
  useEffect(() => {
    if (selectedVenue) refs.current.get(selectedVenue)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [selectedVenue])

  const groups = groupBy(occurrences, (o) => o.time.venue)
  if (!occurrences.length) return <Empty />

  return (
    <>
      {VENUES.filter((v) => groups.has(v.id)).map((v) => {
        const list = groups.get(v.id)!.sort(byStart)
        const mix = [...groupBy(list, (o) => topicOf(o.session.topics[0]))].map(([t, l]) => ({
          label: t.label,
          color: t.color,
          n: l.length,
        }))
        return (
          <section
            key={v.id}
            className="group"
            ref={(el) => {
              if (el) refs.current.set(v.id, el)
            }}
          >
            <header className="group__head" style={{ '--c': v.color } as React.CSSProperties}>
              <i className="dot" />
              <div className="group__title">
                <h2>{v.label}</h2>
                <small>{v.note}</small>
              </div>
              <span className="count">{list.length}</span>
            </header>
            <MixBar parts={mix} />
            {list.map((o) => (
              <SessionCard
                key={o.key}
                occ={o}
                starred={starred.has(o.session.id)}
                onToggleStar={onToggleStar}
                hide={{ venue: true }}
              />
            ))}
          </section>
        )
      })}
    </>
  )
}

export function TimeView({ occurrences, starred, onToggleStar }: CommonProps) {
  if (!occurrences.length) return <Empty />
  const slots = [...groupBy(occurrences, (o) => o.time.start)].sort(([a], [b]) => a.localeCompare(b))

  return (
    <>
      {slots.map(([start, list]) => {
        const venues = groupBy(list, (o) => o.time.venue)
        return (
          <section key={start} className="group">
            <header className="group__head group__head--time">
              <h2>{start}〜</h2>
              <div className="slot-venues">
                {VENUES.map((v) => (
                  <span key={v.id} className={venues.has(v.id) ? '' : 'is-none'} style={{ '--c': v.color } as React.CSSProperties}>
                    {v.short} {venues.get(v.id)?.length ?? 0}
                  </span>
                ))}
              </div>
            </header>
            {VENUES.filter((v) => venues.has(v.id)).map((v) => (
              <div key={v.id} className="subgroup">
                <h3 style={{ '--c': v.color } as React.CSSProperties}>
                  <i className="dot" />
                  {v.label}
                  <span className="count count--sm">{venues.get(v.id)!.length}</span>
                </h3>
                {venues
                  .get(v.id)!
                  .sort(byStart)
                  .map((o) => (
                    <SessionCard
                      key={o.key}
                      occ={o}
                      starred={starred.has(o.session.id)}
                      onToggleStar={onToggleStar}
                      hide={{ venue: true }}
                    />
                  ))}
              </div>
            ))}
          </section>
        )
      })}
    </>
  )
}

export function CategoryView({
  occurrences,
  starred,
  onToggleStar,
  activeTopics,
}: CommonProps & { activeTopics: Set<string> }) {
  if (!occurrences.length) return <Empty />

  // 複数トピックを持つセッションは、該当するすべてのカテゴリに出す
  const groups = new Map<string, Occurrence[]>()
  for (const o of occurrences) {
    const ids = o.session.topics.length ? o.session.topics : ['']
    for (const id of ids) {
      if (activeTopics.size && !activeTopics.has(id)) continue
      const arr = groups.get(id) ?? []
      arr.push(o)
      groups.set(id, arr)
    }
  }
  const order = [...TOPICS.map((t) => t.id), '']
  const sorted = [...groups].sort(
    ([a, la], [b, lb]) => lb.length - la.length || order.indexOf(a) - order.indexOf(b),
  )
  const openAll = sorted.length <= 2

  return (
    <>
      {sorted.map(([id, list]) => {
        const tp = topicOf(id)
        const mix = [...groupBy(list, (o) => o.time.venue)].map(([vid, l]) => ({
          label: VENUE_BY_ID.get(vid)?.label ?? vid,
          color: VENUE_BY_ID.get(vid)?.color ?? '#888',
          n: l.length,
        }))
        return (
          <details key={id} className="group group--fold" open={openAll}>
            <summary className="group__head" style={{ '--c': tp.color } as React.CSSProperties}>
              <i className="dot" />
              <div className="group__title">
                <h2>{tp.label}</h2>
                {id && tp.label !== id && <small>{id}</small>}
              </div>
              <span className="count">{list.length}</span>
            </summary>
            <MixBar parts={mix} />
            <div className="legend">
              {mix.map((m) => (
                <span key={m.label} style={{ '--c': m.color } as React.CSSProperties}>
                  {m.label} {m.n}
                </span>
              ))}
            </div>
            {list.sort(byStart).map((o) => (
              <SessionCard
                key={o.key}
                occ={o}
                starred={starred.has(o.session.id)}
                onToggleStar={onToggleStar}
              />
            ))}
          </details>
        )
      })}
    </>
  )
}
