// 会場（カタログの room 先頭の値）とトピックの表示用マスタ

export type Venue = {
  id: string // カタログ上の会場名
  label: string
  short: string
  note: string
  lat: number
  lng: number
  color: string
}

// 北から順
export const VENUES: Venue[] = [
  {
    id: 'Wynn/Encore',
    label: 'Wynn / Encore',
    short: 'Wynn',
    note: 'Wynn と Encore のコンベンションエリア',
    lat: 36.1281,
    lng: -115.1652,
    color: '#f2b84b',
  },
  {
    id: 'Venetian',
    label: 'Venetian',
    short: 'Venetian',
    note: 'Venetian Expo（Expo 会場）を含む',
    lat: 36.1216,
    lng: -115.1688,
    color: '#5bc0eb',
  },
  {
    id: 'Caesars Forum',
    label: 'Caesars Forum',
    short: 'Forum',
    note: 'LINQ の裏手にあるカンファレンスセンター',
    lat: 36.1183,
    lng: -115.1648,
    color: '#9bc53d',
  },
  {
    id: 'Caesars Palace',
    label: 'Caesars Palace',
    short: 'Palace',
    note: 'Strip 西側。Promenade レベルが中心',
    lat: 36.1162,
    lng: -115.1740,
    color: '#e55934',
  },
  {
    id: 'MGM Grand',
    label: 'MGM Grand',
    short: 'MGM',
    note: 'Strip 南側。セッション数が最多',
    lat: 36.1025,
    lng: -115.1697,
    color: '#c77dff',
  },
]

export const VENUE_BY_ID = new Map(VENUES.map((v) => [v.id, v]))

export type Topic = { id: string; label: string; color: string }

export const TOPICS: Topic[] = [
  { id: 'Artificial Intelligence', label: 'AI', color: '#a78bfa' },
  { id: 'Business Agents', label: 'ビジネスエージェント', color: '#f472b6' },
  { id: 'Security & Identity', label: 'セキュリティ', color: '#f87171' },
  { id: 'Architecture', label: 'アーキテクチャ', color: '#fb923c' },
  { id: 'Cloud Operations', label: 'クラウド運用', color: '#fbbf24' },
  { id: 'Migration & Modernization', label: '移行・モダナイズ', color: '#a3e635' },
  { id: 'Developer Tools', label: '開発者ツール', color: '#4ade80' },
  { id: 'Compute', label: 'コンピュート', color: '#2dd4bf' },
  { id: 'Databases', label: 'データベース', color: '#22d3ee' },
  { id: 'Serverless', label: 'サーバーレス', color: '#38bdf8' },
  { id: 'Analytics', label: '分析', color: '#60a5fa' },
  { id: 'Industry Solutions', label: '業界ソリューション', color: '#818cf8' },
  { id: 'Containers', label: 'コンテナ', color: '#c084fc' },
  { id: 'Storage', label: 'ストレージ', color: '#e879f9' },
  { id: 'Application Integration', label: 'アプリ統合', color: '#fda4af' },
  { id: 'Networking & Content Delivery', label: 'ネットワーク', color: '#fcd34d' },
  { id: 'Hybrid Cloud & Multicloud', label: 'ハイブリッド / マルチクラウド', color: '#86efac' },
  { id: 'Open Source', label: 'オープンソース', color: '#94a3b8' },
]

export const TOPIC_BY_ID = new Map(TOPICS.map((t) => [t.id, t]))
export const UNKNOWN_TOPIC: Topic = { id: '', label: '未分類', color: '#64748b' }

export const topicOf = (id: string | undefined) => (id && TOPIC_BY_ID.get(id)) || UNKNOWN_TOPIC

export const DAYS = [
  { date: '2026-11-30', label: '11/30', week: '月' },
  { date: '2026-12-01', label: '12/1', week: '火' },
  { date: '2026-12-02', label: '12/2', week: '水' },
  { date: '2026-12-03', label: '12/3', week: '木' },
  { date: '2026-12-04', label: '12/4', week: '金' },
]
