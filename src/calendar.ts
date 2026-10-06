import { VENUE_BY_ID } from './data/master'
import { PLAN_KINDS, fromMin, type PlanItem } from './plan'

/** 会期（11/29〜12/4）はすべて太平洋標準時（PST = UTC-8）。夏時間は 11/1 に終わっている */
const PST_OFFSET_MIN = 8 * 60

const CATALOG_URL = 'https://registration.awsevents.com/flow/awsevents/reinvent2026/eventcatalog/page/eventcatalog'

export type CalendarEntry = {
  uid: string
  date: string // 2026-12-01（現地）
  start: number // 現地の分
  end: number
  title: string
  location: string
  details: string
}

/** 現地の日付と分を、UTC の 20261201T163000Z 形式にする */
function toUtcStamp(date: string, min: number) {
  const [y, m, d] = date.split('-').map(Number)
  const t = new Date(Date.UTC(y, m - 1, d, 0, min + PST_OFFSET_MIN))
  return t.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

export function toEntry(item: PlanItem, date: string): CalendarEntry {
  if (item.type === 'session') {
    const { session: s, time: t } = item.occ
    const venue = VENUE_BY_ID.get(t.venue)?.label ?? t.venue
    return {
      uid: `${item.occ.key}@reinvent2026-sessionmap`,
      date,
      start: item.start,
      end: item.end,
      title: `${s.code} ${s.title}`,
      location: [venue, t.room].filter(Boolean).join(' / '),
      details: [`${s.type} / ${s.level}`, s.abstract, `公式カタログ: ${CATALOG_URL}?search=${encodeURIComponent(s.code)}`]
        .filter(Boolean)
        .join('\n\n'),
    }
  }
  const ev = item.ev
  return {
    uid: `${ev.id}@reinvent2026-sessionmap`,
    date,
    start: item.start,
    end: item.end,
    title: `${PLAN_KINDS[ev.kind].label}: ${ev.title}`,
    location: VENUE_BY_ID.get(ev.place)?.label ?? ev.place,
    details: `re:Invent 2026 マイプラン（${fromMin(item.start)}–${fromMin(item.end)} 現地時間）`,
  }
}

export function googleCalendarUrl(e: CalendarEntry) {
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${toUtcStamp(e.date, e.start)}/${toUtcStamp(e.date, e.end)}`,
    location: e.location,
    details: e.details,
  })
  return `https://calendar.google.com/calendar/render?${params}`
}

/** iCalendar のテキスト値のエスケープ（RFC 5545 3.3.11） */
const esc = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n')

const utf8 = new TextEncoder()

/**
 * 1 行 75 オクテットを超えないよう折り返す（RFC 5545 3.1）。
 * 日本語は 1 文字 3 バイトなので、文字数ではなく UTF-8 のバイト数で数え、文字の途中では切らない
 */
function fold(line: string) {
  const out: string[] = []
  let current = ''
  let bytes = 0
  for (const ch of line) {
    const n = utf8.encode(ch).length
    // 2 行目以降は先頭に空白 1 バイトが付くので、中身は 74 バイトまで
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(current)
      current = ''
      bytes = 0
    }
    current += ch
    bytes += n
  }
  out.push(current)
  return out.join('\r\n ')
}

export function buildIcs(entries: CalendarEntry[]) {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//reinvent2026-sessionmap//JA',
    'CALSCALE:GREGORIAN',
    'X-WR-CALNAME:re:Invent 2026 マイプラン',
    ...entries.flatMap((e) => [
      'BEGIN:VEVENT',
      `UID:${e.uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${toUtcStamp(e.date, e.start)}`,
      `DTEND:${toUtcStamp(e.date, e.end)}`,
      `SUMMARY:${esc(e.title)}`,
      `LOCATION:${esc(e.location)}`,
      `DESCRIPTION:${esc(e.details)}`,
      'END:VEVENT',
    ]),
    'END:VCALENDAR',
  ]
  return lines.map(fold).join('\r\n') + '\r\n'
}

export function downloadIcs(filename: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
