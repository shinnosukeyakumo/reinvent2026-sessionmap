export type SessionTime = {
  date: string // 2026-11-30
  start: string // 08:30
  end: string
  venue: string
  room: string
}

export type Session = {
  id: string
  code: string
  title: string
  abstract: string
  type: string
  level: string
  topics: string[]
  areas: string[]
  sponsored: boolean
  speakers: string[]
  times: SessionTime[]
  /** カタログで初めて見つけた日時（取得スクリプトが記録する） */
  firstSeen?: string
  /** アプリ側で付ける新着の印 */
  isNew?: boolean
}

export type Catalog = {
  fetchedAt: string
  total: number
  sessions: Session[]
}

/** 1 セッション × 1 開催枠。繰り返し開催は別の Occurrence になる */
export type Occurrence = {
  key: string
  session: Session
  time: SessionTime
}

export type ViewMode = 'venue' | 'time' | 'category' | 'plan'
