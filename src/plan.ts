import { useEffect, useState } from 'react'
import { VENUE_BY_ID } from './data/master'
import type { Occurrence } from './types'

/** 宿泊ホテル。1 日の起点と終点として距離計算に使う */
export const HOME_VENUE = 'MGM Grand'

/**
 * 録画が残らない（現地でしか受けられない）想定の形式。
 * 例年 Breakout session は録画公開されるが、2026 年の方針は未確認。
 */
export const LIVE_ONLY_TYPES = new Set([
  'Workshop',
  "Builders' session",
  'Chalk talk',
  'Lab',
  'Bootcamp',
  'Gamified learning',
])

export type PlanKind = 'keynote' | 'blog' | 'community' | 'swag' | 'other'

export const PLAN_KINDS: Record<PlanKind, { label: string; color: string }> = {
  keynote: { label: '基調講演', color: '#ff6ec7' },
  blog: { label: 'ブログ執筆', color: '#5bc0eb' },
  community: { label: '交流', color: '#f2b84b' },
  swag: { label: 'スワグ回収', color: '#9bc53d' },
  other: { label: 'その他', color: '#94a3b8' },
}

export type PlanEvent = {
  id: string
  date: string
  start: string
  end: string
  kind: PlanKind
  title: string
  /** 会場 ID（VENUES の id）または自由入力の場所名 */
  place: string
  tentative?: boolean
}

// 公式アジェンダ（aws.amazon.com/events/reinvent/agenda/、2026-10-06 確認）の主な予定
const SEED: PlanEvent[] = [
  { id: 'off-kickoff', date: '2026-11-29', start: '10:00', end: '18:00', kind: 'swag', title: 'Kickoff（バッジ受け取り・スワグ）', place: 'Caesars Forum' },
  { id: 'off-welcome', date: '2026-11-30', start: '16:00', end: '19:00', kind: 'community', title: 'Expo Welcome reception', place: 'Venetian' },
  { id: 'kn-tue', date: '2026-12-01', start: '08:30', end: '10:30', kind: 'keynote', title: '基調講演（CEO Matt Garman）', place: 'Venetian' },
  { id: 'kn-wed', date: '2026-12-02', start: '08:30', end: '10:00', kind: 'keynote', title: '基調講演', place: 'Venetian' },
  { id: 'kn-wed-pm', date: '2026-12-02', start: '15:00', end: '16:30', kind: 'keynote', title: '基調講演（午後）', place: 'Venetian' },
  { id: 'kn-thu', date: '2026-12-03', start: '08:30', end: '10:00', kind: 'keynote', title: '基調講演', place: 'Venetian' },
  { id: 'off-replay', date: '2026-12-03', start: '19:30', end: '23:59', kind: 'community', title: 're:Play', place: 'Las Vegas Festival Grounds' },
]

const PLAN_KEY = 'sessionmap:plan'
const SEED_VERSION_KEY = 'sessionmap:seedVersion'
const SEED_VERSION = 2

/**
 * 保存済みの予定に、新しい版の公式予定を取り込む。
 * v1 は基調講演を仮置きしていた。編集されていない仮置き（tentative のまま）だけを捨てる
 */
function migrate(events: PlanEvent[], from: number): PlanEvent[] {
  if (from >= SEED_VERSION) return events
  const kept = events.filter((e) => !(e.id.startsWith('kn-') && e.tentative))
  const ids = new Set(kept.map((e) => e.id))
  return [...kept, ...SEED.filter((e) => !ids.has(e.id))]
}

function loadPlan(): PlanEvent[] {
  try {
    const raw = localStorage.getItem(PLAN_KEY)
    if (!raw) return SEED
    const from = Number(localStorage.getItem(SEED_VERSION_KEY) ?? 1)
    return migrate(JSON.parse(raw), from)
  } catch {
    return SEED
  }
}

export function usePlan() {
  const [events, setEvents] = useState<PlanEvent[]>(loadPlan)

  useEffect(() => {
    try {
      localStorage.setItem(PLAN_KEY, JSON.stringify(events))
      localStorage.setItem(SEED_VERSION_KEY, String(SEED_VERSION))
    } catch {
      // 保存できない環境でも画面上の操作は続けられる
    }
  }, [events])

  const add = (e: Omit<PlanEvent, 'id'>) =>
    setEvents((prev) => [...prev, { ...e, id: crypto.randomUUID() }])
  const update = (id: string, patch: Partial<PlanEvent>) =>
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)))
  const remove = (id: string) => setEvents((prev) => prev.filter((e) => e.id !== id))

  return { events, add, update, remove }
}

export const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number)
  return h * 60 + m
}

export const fromMin = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`

/** 2 会場間の直線距離（km）。場所が会場でなければ null */
export function distanceKm(a: string, b: string): number | null {
  const va = VENUE_BY_ID.get(a)
  const vb = VENUE_BY_ID.get(b)
  if (!va || !vb) return null
  const rad = (d: number) => (d * Math.PI) / 180
  const dLat = rad(vb.lat - va.lat)
  const dLng = rad(vb.lng - va.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(va.lat)) * Math.cos(rad(vb.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * 6371 * Math.asin(Math.sqrt(h))
}

/** 徒歩の目安（分）。ホテル内の移動ぶんを見込み、直線距離 ×1.4 を時速 4.5km で歩く想定 */
export const walkMinutes = (km: number) => Math.round(((km * 1.4) / 4.5) * 60)

export type PlanItem =
  | { type: 'session'; start: number; end: number; place: string; occ: Occurrence }
  | { type: 'event'; start: number; end: number; place: string; ev: PlanEvent }

export function buildItems(day: string, sessions: Occurrence[], events: PlanEvent[]): PlanItem[] {
  const items: PlanItem[] = [
    ...sessions.map((occ) => ({
      type: 'session' as const,
      start: toMin(occ.time.start),
      end: toMin(occ.time.end),
      place: occ.time.venue,
      occ,
    })),
    ...events
      .filter((ev) => ev.date === day)
      .map((ev) => ({ type: 'event' as const, start: toMin(ev.start), end: toMin(ev.end), place: ev.place, ev })),
  ]
  return items.sort((a, b) => a.start - b.start || a.end - b.end)
}
