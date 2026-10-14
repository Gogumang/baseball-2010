import { useRef } from 'react'
import { screenOffsetOf, toScreenX, toScreenY } from '@/pages/defense/lib/defenseCamera'
import {
  type HalfInningWalkInput,
  type HalfInningWalkState,
  halfInningNameTagSlotOf,
  startHalfInningWalk,
  stepHalfInningWalk,
} from '@/widgets/field-walk/lib/halfInningWalk'
import { nameTagBoxOf, nameTagPiecesOf } from '@/widgets/field-walk/lib/nameTag'
import { FieldWalkView } from '@/widgets/field-walk/ui/FieldWalkView'
import * as styles from '@/widgets/field-walk/ui/FieldWalkView.css'

export interface HalfInningFieldProps {
  readonly input: HalfInningWalkInput
  /** 판 틱(경기+0x2c) — 판이 선 틱이 0 */
  readonly tick: number
  /** 수비 팀(st[0xa]) 번호 — 수비 줄 그림 [+0x177c] 의 팔레트 (0x3fac4 의 0x79a54(…, 0xb6c09(st))) */
  readonly defenseTeam?: number | null
  /** 공격 팀(st[9]) 번호 — 공격 줄 그림 [+0xf20] 의 팔레트 (0x79a54(…, 0xb6bf9(st))) */
  readonly offenseTeam?: number | null
  /** 수비 바탕 잔디 팔레트 줄 */
  readonly grassPalette?: number | null
  /**
   * 이름표 이름 — 수비 칸 0 은 지금 투수(0xae83c), 1~8 은 그 칸 선수(0x40008). 칸 이름이 없으면(null) 그 칸 이름표를 안 그린다
   * (원본도 선수가 없으면 안 그린다). 안 주면 이름표가 없다.
   */
  readonly fielderNames?: readonly (string | null)[]
}

/**
 * **공수 교대 판의 운동장 전경 0x4fb8c** — `lib/halfInningWalk` 의 상태를 판 틱마다 한 걸음씩 굴려 그린다.
 * 수비 줄(새 수비)이 더그아웃에서 제자리로 걷고, 공격 줄(앞 반 이닝 수비)이 더그아웃으로 들어가며, 틱 100 뒤 카메라가 야수를 하나씩
 * 비추며 그 선수 이름표를 단다. 모드 0 · 자동진행(+0x1784) · 경기 끝이면 원본도 안 그린다 — 부르는 쪽이 판을 세울 때만 쓴다.
 */
export function HalfInningField({ input, tick, defenseTeam = null, offenseTeam = null, grassPalette = null, fielderNames }: HalfInningFieldProps) {
  const memory = useRef<{ readonly input: HalfInningWalkInput; readonly tick: number; readonly state: HalfInningWalkState } | null>(null)
  let current = memory.current
  // 판 재료가 같으면(굴림 · 측 · 앞 자리) 이어서 굴린다 — 부르는 쪽이 그림마다 새 꼴을 만들어도 처음부터 다시 돌지 않는다
  const isSameInput = current !== null && current.input.rolls === input.rolls
    && current.input.offenseSide === input.offenseSide && current.input.previousFielders === input.previousFielders
  if (current === null || !isSameInput || current.tick > tick) {
    current = { input, tick: -1, state: startHalfInningWalk(input) }
  }
  let { state } = current
  for (let t = current.tick + 1; t <= tick; t += 1) state = stepHalfInningWalk(state, t)
  memory.current = { input, tick: Math.max(tick, current.tick), state }

  const offset = screenOffsetOf(state.camera)
  const tagSlot = halfInningNameTagSlotOf(state, tick)
  const tagName = tagSlot === null ? null : fielderNames?.[tagSlot] ?? null
  const tagFielder = tagSlot === null ? undefined : state.fielders[tagSlot]
  const tagBox = tagName === null || tagFielder === undefined
    ? null
    : nameTagBoxOf({ x: toScreenX(tagFielder.x) + offset.x, y: toScreenY(tagFielder.z) + offset.y })

  return (
    <FieldWalkView
      offset={offset}
      grassPalette={grassPalette}
      rows={[
        // 4fbd2 0x43010(장면, [+0x177c], +0x111c, 0) — 수비 줄
        { walkers: state.fielders, teamIndex: defenseTeam },
        // 4fbea 0x43010(장면, [+0xf20], +0x1758, 1) — 공격 줄
        { walkers: state.offense, teamIndex: offenseTeam },
      ]}
    >
      {tagBox !== null && (
        <div data-testid="운동장-이름표" data-slot={tagSlot}>
          {nameTagPiecesOf(tagBox).map((piece, index) => (
            <span key={index} className={styles.block}
              style={{ left: piece.x, top: piece.y, width: piece.width, height: piece.height, background: piece.color }} />
          ))}
          <div className={styles.tagText}
            style={{ left: tagBox.x, top: tagBox.y, width: tagBox.width, height: tagBox.height }}>
            {tagName}
          </div>
        </div>
      )}
    </FieldWalkView>
  )
}
