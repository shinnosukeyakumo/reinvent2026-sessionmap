import { useEffect, useMemo, useState } from 'react'
import { DAYS, TOPICS, VENUE_BY_ID } from './data/master'
import { MapView } from './components/MapView'
import { CategoryView, TimeView, VenueView } from './components/Views'
import { PlanView } from './components/PlanView'
import { ReservationCopy } from './components/ReservationCopy'
import { HOME_VENUE, LIVE_ONLY_TYPES, buildItems, usePlan } from './plan'
import type { Catalog, Occurrence, ViewMode } from './types'

const STAR_KEY = 'sessionmap:starred'

function loadStarred(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(STAR_KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

const VIEWS: { id: ViewMode; label: string }[] = [
  { id: 'venue', label: '会場別' },
  { id: 'time', label: '時間別' },
  { id: 'category', label: 'カテゴリ別' },
  { id: 'plan', label: 'マイプラン' },
]

export default function App() {
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [error, setError] = useState<string | null>(null)

  // 11/29（日）はセッションが無い前日なので、初期表示は初日の 11/30 にする
  const [day, setDay] = useState('2026-11-30')
  const [view, setView] = useState<ViewMode>('venue')
  const [venue, setVenue] = useState<string | null>(null)
  const [slot, setSlot] = useState<string | null>(null)
  const [topics, setTopics] = useState<Set<string>>(new Set())
  const [type, setType] = useState('')
  const [query, setQuery] = useState('')
  const [starOnly, setStarOnly] = useState(false)
  // 録画が残らない形式（ワークショップ等）を優先して探したいので、既定でオン
  const [liveOnly, setLiveOnly] = useState(true)
  const plan = usePlan()
  const [starred, setStarred] = useState<Set<string>>(loadStarred)

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/sessions.json`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then(setCatalog)
      .catch((e) => setError(String(e)))
  }, [])

  useEffect(() => {
    try {
      localStorage.setItem(STAR_KEY, JSON.stringify([...starred]))
    } catch {
      // プライベートウィンドウ等では保存できなくても動作は続ける
    }
  }, [starred])

  const toggleStar = (id: string) =>
    setStarred((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const toggleTopic = (id: string) =>
    setTopics((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allOccurrences = useMemo<Occurrence[]>(
    () =>
      (catalog?.sessions ?? []).flatMap((s) =>
        s.times.map((t, i) => ({ key: `${s.id}-${i}`, session: s, time: t })),
      ),
    [catalog],
  )

  const types = useMemo(
    () => [...new Set(allOccurrences.map((o) => o.session.type))].sort(),
    [allOccurrences],
  )

  // 日付・会場・時間枠以外の条件（地図とリストで共通）
  const matched = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allOccurrences.filter((o) => {
      const s = o.session
      if (o.time.date !== day) return false
      if (topics.size && !s.topics.some((t) => topics.has(t))) return false
      if (type && s.type !== type) return false
      if (liveOnly && !LIVE_ONLY_TYPES.has(s.type)) return false
      if (starOnly && !starred.has(s.id)) return false
      if (q) {
        const hay = `${s.code} ${s.title} ${s.abstract} ${s.speakers.join(' ')} ${s.areas.join(' ')}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  }, [allOccurrences, day, topics, type, liveOnly, starOnly, starred, query])

  const slots = useMemo(() => [...new Set(matched.map((o) => o.time.start))].sort(), [matched])

  // 地図は会場で絞らない（全ホテルの件数を見比べたいので）
  const forMap = useMemo(() => (slot ? matched.filter((o) => o.time.start === slot) : matched), [matched, slot])
  const forList = useMemo(() => (venue ? forMap.filter((o) => o.time.venue === venue) : forMap), [forMap, venue])

  const starredAll = useMemo(() => allOccurrences.filter((o) => starred.has(o.session.id)), [allOccurrences, starred])
  // マイプランは絞り込み条件に関係なく、その日の★付きセッションをすべて出す
  const planSessions = useMemo(
    () => allOccurrences.filter((o) => o.time.date === day && starred.has(o.session.id)),
    [allOccurrences, day, starred],
  )
  const route = useMemo(
    () =>
      view === 'plan'
        ? [HOME_VENUE, ...buildItems(day, planSessions, plan.events).map((i) => i.place), HOME_VENUE]
        : [],
    [view, day, planSessions, plan.events],
  )

  const changeDay = (d: string) => {
    setDay(d)
    setSlot(null)
  }

  const common = { occurrences: forList, starred, onToggleStar: toggleStar }
  const venueLabel = venue ? VENUE_BY_ID.get(venue)?.label ?? venue : null
  const hasFilter = venue || slot || topics.size || type || query || starOnly || !liveOnly

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand__mark">re:Invent 2026</span>
          <span className="brand__name">Session Map</span>
        </div>
        <nav className="days" aria-label="日付">
          {DAYS.map((d) => (
            <button
              key={d.date}
              type="button"
              className={d.date === day ? 'is-active' : ''}
              onClick={() => changeDay(d.date)}
            >
              {d.label}
              <small>{d.week}</small>
            </button>
          ))}
        </nav>
        <input
          className="search"
          type="search"
          placeholder="タイトル・コード・登壇者で検索"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </header>

      <main className="layout">
        <div className="map-wrap">
          <MapView occurrences={forMap} selectedVenue={venue} onSelectVenue={setVenue} route={route} />
          <div className="map-caption">
            {slot ? `${slot}〜 の枠` : '終日'}・{forMap.length} 件
            <span>マーカーの色はカテゴリ構成比。クリックでホテルを選択</span>
          </div>
        </div>

        <aside className="panel">
          <div className="panel__controls">
            <div className="tabs" role="tablist">
              {VIEWS.map((v) => (
                <button
                  key={v.id}
                  type="button"
                  role="tab"
                  aria-selected={view === v.id}
                  className={view === v.id ? 'is-active' : ''}
                  onClick={() => setView(v.id)}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {view === 'plan' ? (
              <div className="summary">
                ☆ を付けたセッションと、基調講演・交流会などの予定を 1 日の流れで並べる。移動は宿（MGM Grand）起点。
              </div>
            ) : (
            <>
            <div className="row scroll-x" aria-label="時間枠">
              <button type="button" className={`pill${slot ? '' : ' is-active'}`} onClick={() => setSlot(null)}>
                終日
              </button>
              {slots.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`pill${slot === s ? ' is-active' : ''}`}
                  onClick={() => setSlot(slot === s ? null : s)}
                >
                  {s}
                </button>
              ))}
            </div>

            <div className="row scroll-x" aria-label="カテゴリ">
              {TOPICS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`chip${topics.has(t.id) ? ' is-active' : ''}`}
                  style={{ '--c': t.color } as React.CSSProperties}
                  onClick={() => toggleTopic(t.id)}
                  title={t.id}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="row">
              <select value={type} onChange={(e) => setType(e.target.value)} aria-label="セッション形式">
                <option value="">すべての形式</option>
                {types.map((t) => (
                  <option key={t}>{t}</option>
                ))}
              </select>
              <label className="toggle" title="Workshop / Builders' session / Chalk talk / Lab など。例年の傾向にもとづく分類で、2026 年の録画方針は未確認">
                <input type="checkbox" checked={liveOnly} onChange={(e) => setLiveOnly(e.target.checked)} />
                録画なし形式のみ
              </label>
              <label className="toggle">
                <input type="checkbox" checked={starOnly} onChange={(e) => setStarOnly(e.target.checked)} />★ のみ
              </label>
              {venue !== HOME_VENUE && (
                <button type="button" className="pill" onClick={() => setVenue(HOME_VENUE)}>
                  宿（MGM）だけ
                </button>
              )}
              {venueLabel && (
                <button type="button" className="pill is-active" onClick={() => setVenue(null)}>
                  {venueLabel} ×
                </button>
              )}
              {hasFilter && (
                <button
                  type="button"
                  className="link"
                  onClick={() => {
                    setVenue(null)
                    setSlot(null)
                    setTopics(new Set())
                    setType('')
                    setQuery('')
                    setStarOnly(false)
                    setLiveOnly(true)
                  }}
                >
                  条件をクリア
                </button>
              )}
            </div>
            <div className="summary">{forList.length} 件のセッション</div>
            </>
            )}
          </div>

          <div className="panel__list">
            {error && <p className="empty">データを読み込めなかった: {error}</p>}
            {!catalog && !error && <p className="empty">読み込み中…</p>}
            {catalog && view === 'venue' && <VenueView {...common} selectedVenue={venue} />}
            {catalog && view === 'time' && <TimeView {...common} />}
            {catalog && view === 'category' && <CategoryView {...common} activeTopics={topics} />}
            {catalog && view === 'plan' && (
              <>
                <ReservationCopy occurrences={starredAll} />
                <PlanView day={day} sessions={planSessions} plan={plan} starred={starred} onToggleStar={toggleStar} />
              </>
            )}
          </div>

          {catalog && (
            <footer className="panel__foot">
              出典: AWS re:Invent 2026 公式セッションカタログ（
              {new Date(catalog.fetchedAt).toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' })} 取得）。
              時刻は現地時間（PT）。
            </footer>
          )}
        </aside>
      </main>
    </div>
  )
}
