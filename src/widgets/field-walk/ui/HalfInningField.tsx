import type { MutableRefObject } from 'react'
import { screenOffsetOf, toScreenX, toScreenY } from '@/pages/defense/lib/defenseCamera'
import {
  type HalfInningWalkInput,
  type HalfInningWalkState,
  halfInningNameTagSlotOf,
  startHalfInningWalk,
  stepHalfInningWalk,
} from '@/widgets/field-walk/lib/halfInningWalk'
import { nameTagBoxOf, nameTagPiecesOf } from '@/widgets/field-walk/lib/nameTag'
import type { WalkerAceSprite } from '@/widgets/field-walk/lib/walkerAces'
import type { FieldWalker } from '@/widgets/field-walk/lib/fieldWalker'
import { FieldWalkView } from '@/widgets/field-walk/ui/FieldWalkView'
import * as styles from '@/widgets/field-walk/ui/FieldWalkView.css'
import { useRenderMachine } from '@/shared/lib/renderMachine/useRenderMachine'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'

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
  /** 수비 줄 칸별 마선수 그림 (0x79b48 a · b — `lib/walkerAces`). 안 주면 보통 그림 */
  readonly defenseAces?: readonly (WalkerAceSprite | null)[]
  /** 공격 줄 칸별 마선수 그림 */
  readonly offenseAces?: readonly (WalkerAceSprite | null)[]
  /**
   * 그린 틱의 걸음 상태를 적어 두는 칸 — 판이 OK 로 닫힐 때 부르는 쪽이 이 자리 · 카메라를 다음 장면으로 넘긴다(`lib/fieldCarry`).
   * 원본은 같은 야수 · 카메라 객체가 경기 내내 산다.
   */
  readonly walkStateRef?: MutableRefObject<HalfInningWalkState | null>
}

interface WalkMemory {
  readonly input: HalfInningWalkInput
  readonly tick: number
  readonly state: HalfInningWalkState
}

/** 판 재료가 같은가(굴림 · 측 · 앞 자리 · 앞 카메라) */
function isSameWalkInput(previous: HalfInningWalkInput, input: HalfInningWalkInput): boolean {
  if (previous.rolls !== input.rolls || previous.offenseSide !== input.offenseSide) return false
  return previous.previousFielders === input.previousFielders && previous.previousCamera === input.previousCamera
}

/** 틱 100 뒤 비추는 야수의 이름표 — 칸 · 이름 · 상자. 이름을 모르거나 아직이면 null */
function nameTagOf(
  state: HalfInningWalkState,
  tick: number,
  fielderNames: readonly (string | null)[] | undefined,
  offset: { readonly x: number; readonly y: number },
) {
  const slot = halfInningNameTagSlotOf(state, tick)
  if (slot === null) return null
  const name = fielderNames?.[slot] ?? null
  const fielder = state.fielders[slot]
  if (name === null || fielder === undefined) return null
  return { slot, name, box: nameTagBoxOf({ x: toScreenX(fielder.x) + offset.x, y: toScreenY(fielder.z) + offset.y }) }
}

/** 걸음 줄 하나 — 마선수 그림은 준 것만 */
function walkRowOf(walkers: readonly FieldWalker[], teamIndex: number | null, aces: readonly (WalkerAceSprite | null)[] | undefined) {
  return { walkers, teamIndex, ...(aces === undefined ? {} : { aceSprites: aces }) }
}

/**
 * 판 틱까지 걸음을 굴린다 — 판 재료가 같으면(굴림 · 측 · 앞 자리) 앞 그림의 걸음에서 이어 굴린다. 부르는 쪽이 그림마다 새 꼴을
 * 만들어도 처음부터 다시 돌지 않는다
 */
function advanceWalkMemory(previous: WalkMemory | null, { input, tick }: { readonly input: HalfInningWalkInput; readonly tick: number }): WalkMemory {
  const continues = previous !== null && isSameWalkInput(previous.input, input) && previous.tick <= tick
  const start = continues ? previous : { input, tick: -1, state: startHalfInningWalk(input) }
  let { state } = start
  for (let t = start.tick + 1; t <= tick; t += 1) state = stepHalfInningWalk(state, t)
  return { input, tick: Math.max(tick, start.tick), state }
}

/**
 * **공수 교대 판의 운동장 전경 0x4fb8c** — `lib/halfInningWalk` 의 상태를 판 틱마다 한 걸음씩 굴려 그린다.
 * 수비 줄(새 수비)이 더그아웃에서 제자리로 걷고, 공격 줄(앞 반 이닝 수비)이 더그아웃으로 들어가며, 틱 100 뒤 카메라가 야수를 하나씩
 * 비추며 그 선수 이름표를 단다. 모드 0 · 자동진행(+0x1784) · 경기 끝이면 원본도 안 그린다 — 부르는 쪽이 판을 세울 때만 쓴다.
 */
export function HalfInningField({
  input,
  tick,
  defenseTeam = null,
  offenseTeam = null,
  grassPalette = null,
  fielderNames,
  defenseAces,
  offenseAces,
  walkStateRef,
}: HalfInningFieldProps) {
  const { state } = useRenderMachine(advanceWalkMemory, { input, tick })
  useMirrorRef(walkStateRef, state)

  const offset = screenOffsetOf(state.camera)
  const tag = nameTagOf(state, tick, fielderNames, offset)

  return (
    <FieldWalkView
      offset={offset}
      grassPalette={grassPalette}
      rows={[
        // 4fbd2 0x43010(장면, [+0x177c], +0x111c, 0) — 수비 줄
        walkRowOf(state.fielders, defenseTeam, defenseAces),
        // 4fbea 0x43010(장면, [+0xf20], +0x1758, 1) — 공격 줄
        walkRowOf(state.offense, offenseTeam, offenseAces),
      ]}
    >
      {tag !== null && (
        <div data-testid="운동장-이름표" data-slot={tag.slot}>
          {nameTagPiecesOf(tag.box).map((piece, index) => (
            <span
              key={index}
              className={styles.block}
              style={{ left: piece.x, top: piece.y, width: piece.width, height: piece.height, background: piece.color }}
            />
          ))}
          <div className={styles.tagText} style={{ left: tag.box.x, top: tag.box.y, width: tag.box.width, height: tag.box.height }}>
            {tag.name}
          </div>
        </div>
      )}
    </FieldWalkView>
  )
}
