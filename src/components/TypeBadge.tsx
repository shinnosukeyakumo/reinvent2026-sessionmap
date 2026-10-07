import { typeMeta } from '../data/master'

/** セッション形式の印。日本語名と色で、ワークショップかチョークトークかを一目で分かるようにする */
export function TypeBadge({ type }: { type: string }) {
  const m = typeMeta(type)
  return (
    <span className="type-badge" style={{ '--c': m.color } as React.CSSProperties} title={`${type}: ${m.note}`}>
      {m.label}
    </span>
  )
}
