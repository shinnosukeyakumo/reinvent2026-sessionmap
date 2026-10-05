import { useState } from 'react'
import { DAYS, VENUE_BY_ID } from '../data/master'
import type { Occurrence } from '../types'

/** ★ を付けたセッションを、公式カタログで予約するための作業リスト（テキスト）にする */
function toText(occs: Occurrence[]) {
  const sorted = [...occs].sort(
    (a, b) => a.time.date.localeCompare(b.time.date) || a.time.start.localeCompare(b.time.start),
  )
  const lines: string[] = []
  for (const d of DAYS) {
    const list = sorted.filter((o) => o.time.date === d.date)
    if (!list.length) continue
    lines.push(`${d.label}（${d.week}）`)
    for (const { session: s, time: t } of list) {
      const venue = VENUE_BY_ID.get(t.venue)?.label ?? t.venue
      lines.push(`${t.start}–${t.end} ${s.code} ${s.title}（${venue}${t.room ? ` / ${t.room}` : ''}）`)
    }
    lines.push('')
  }
  return lines.join('\n').trim()
}

async function copy(text: string) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // クリップボード API が使えない環境向け
    const ta = document.createElement('textarea')
    ta.value = text
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    ta.remove()
    return ok
  }
}

export function ReservationCopy({ occurrences }: { occurrences: Occurrence[] }) {
  const [status, setStatus] = useState<string | null>(null)
  const text = toText(occurrences)

  return (
    <div className="reserve">
      <div className="row">
        <button
          type="button"
          className="pill is-active"
          disabled={!occurrences.length}
          onClick={async () => {
            const ok = await copy(text)
            setStatus(ok ? `${occurrences.length} 件をコピーした` : 'コピーできなかった。下の一覧から選択してコピーしてほしい')
          }}
        >
          予約リストをコピー（全日程の ★ {occurrences.length} 件）
        </button>
        {status && <span className="reserve__status">{status}</span>}
      </div>
      <p className="reserve__hint">
        公式カタログの検索欄にコード（例: AIM332-R1）を入れると 1 件に絞れる。お気に入りに入れておくと、予約開放時に 1 クリックで予約できる。
      </p>
      {occurrences.length > 0 && (
        <details>
          <summary>一覧を表示</summary>
          <pre className="reserve__text">{text}</pre>
        </details>
      )}
    </div>
  )
}
