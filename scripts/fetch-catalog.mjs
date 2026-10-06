// re:Invent 2026 のセッションカタログ（RainFocus のイベント API）を全件取得し、
// アプリ用に整形して public/data/sessions.json に書き出す。
// 使い方: npm run fetch:catalog
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ENDPOINT = 'https://catalog.awsevents.com/api/sessions'
// 公開カタログページ（registration.awsevents.com の eventcatalog）が送っている値
const HEADERS = {
  rfapiprofileid: 'mSEPBdEOSHwzxJwd7H8MfSWVylSYQsS4',
  rfwidgetid: 'nbNFIlUhukEGI22KvPEwpPdWgK6FoPsi',
  origin: 'https://registration.awsevents.com',
  referer: 'https://registration.awsevents.com/',
  'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
}
const PAGE_SIZE = 50 // API 側の上限
const WAIT_MS = 400

const OUT = resolve(dirname(fileURLToPath(import.meta.url)), '../public/data/sessions.json')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchPage(from) {
  const body = new URLSearchParams({
    type: 'session',
    browserTimezone: 'America/Los_Angeles',
    catalogDisplay: 'list',
    from: String(from),
    size: String(PAGE_SIZE),
  })
  const res = await fetch(ENDPOINT, { method: 'POST', headers: HEADERS, body })
  if (!res.ok) throw new Error(`HTTP ${res.status} (from=${from})`)
  const json = await res.json()
  if (json.responseCode !== '0') throw new Error(`API error: ${json.responseMessage}`)
  // 初回だけ sectionList で包まれて返ってくる
  const section = json.sectionList?.[0] ?? json
  return { total: section.total, items: section.items ?? [] }
}

const attrValues = (item, attributeId) =>
  (item.attributevalues ?? []).filter((a) => a.attribute_id === attributeId).map((a) => a.value)

function normalize(item) {
  return {
    id: item.sessionID,
    code: item.code,
    title: item.title,
    abstract: item.abstract ?? '',
    type: item.type,
    level: attrValues(item, 'Level')[0] ?? '',
    // スポンサーセッションは Topic が空で、SponsorSessionPrimaryTopic に入っている
    topics: attrValues(item, 'Topic').length
      ? attrValues(item, 'Topic')
      : attrValues(item, 'SponsorSessionPrimaryTopic'),
    areas: attrValues(item, 'AreaofInterest'),
    sponsored: attrValues(item, 'SessionAppendices').includes('Sponsored'),
    speakers: (item.participants ?? []).map((p) =>
      [p.globalFirstname ?? p.firstName, p.lastName].filter(Boolean).join(' '),
    ),
    times: (item.times ?? [])
      .filter((t) => t.inPersonTime !== false)
      .map((t) => {
        const [venue, ...rest] = (t.room ?? '').split(' | ')
        return {
          date: t.date,
          start: t.startTime,
          end: t.endTime,
          venue: venue || 'TBD',
          room: rest.join(' / '),
        }
      }),
  }
}

const all = []
let total = Infinity
for (let from = 0; from < total; from += PAGE_SIZE) {
  const page = await fetchPage(from)
  total = page.total
  all.push(...page.items)
  console.log(`${Math.min(from + PAGE_SIZE, total)} / ${total}`)
  if (page.items.length === 0) break
  await sleep(WAIT_MS)
}

// 前回のデータから「初めて見つけた日時」を引き継ぎ、今回初めて現れたセッションには今の日時を付ける。
// アプリはこれを使って新着セッションに NEW を付ける
const fetchedAt = new Date().toISOString()
let previous = null
try {
  previous = JSON.parse(await readFile(OUT, 'utf8'))
} catch {
  // 初回は前回のデータが無い
}
const firstSeen = new Map((previous?.sessions ?? []).map((s) => [s.id, s.firstSeen ?? previous.fetchedAt]))
const sessions = all.map(normalize).map((s) => ({ ...s, firstSeen: firstSeen.get(s.id) ?? fetchedAt }))
const added = sessions.filter((s) => !firstSeen.has(s.id))
await mkdir(dirname(OUT), { recursive: true })
await writeFile(
  OUT,
  JSON.stringify({ fetchedAt, total: sessions.length, sessions }),
)
console.log(`wrote ${sessions.length} sessions (new: ${previous ? added.length : 'first run'}) -> ${OUT}`)
