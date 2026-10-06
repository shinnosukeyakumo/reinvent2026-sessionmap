import { PLACEABLE_KINDS, PLAN_KINDS, type PlanKind } from '../plan'

type Props = {
  armed: PlanKind | null
  onArm: (kind: PlanKind | null) => void
}

/** マイプランに置く予定の部品。PC はドラッグ、スマホはタップして選んでから時間軸をタップする */
export function PlanPalette({ armed, onArm }: Props) {
  return (
    <div className="palette">
      <div className="palette__items">
        {PLACEABLE_KINDS.map((k) => (
          <button
            key={k}
            type="button"
            draggable
            className={`palette__item${armed === k ? ' is-armed' : ''}`}
            style={{ '--c': PLAN_KINDS[k].color } as React.CSSProperties}
            onDragStart={(e) => {
              e.dataTransfer.setData('text/plan-kind', k)
              e.dataTransfer.effectAllowed = 'copy'
              onArm(null)
            }}
            onClick={() => onArm(armed === k ? null : k)}
          >
            + {PLAN_KINDS[k].label}
          </button>
        ))}
      </div>
      <p className="palette__hint">
        {armed
          ? `時間軸の置きたい時刻をタップすると「${PLAN_KINDS[armed].label}」が入る`
          : 'PC はドラッグして時間軸へ。スマホはタップしてから時間軸の時刻をタップ'}
      </p>
    </div>
  )
}
