import {
  FIELDER_ACTION,
  fielderActionFrameOf,
  type DefenseFielder,
  type DefenseRunner,
  type DefenseViewState,
} from '@/pages/defense/lib/defenseView'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

/** effect/player_effect.pzx (게임+0x1030) */
export const PLAYER_EFFECT_FRAMES = assetUrl('./sprites/player_effect/frames')

/** 그리기 목록에 넣는 부착 효과 한 장 */
export interface PlayerEffectMark {
  readonly key: string
  /** 'anim' = 0xbe8a5(애니, 그린 뒤 0x93d91 한 칸) · 'frame' = 0xbe8d5(프레임 그대로) */
  readonly kind: 'anim' | 'frame'
  /** 애니 번호 또는 프레임 번호 */
  readonly index: number
  /** 그리는 바닥점 — 화면이 야수 · 주자와 같은 투영으로 옮긴다 */
  readonly x: number
  readonly z: number
  /** 화면점에서 위로 올리는 값 (y − raise) */
  readonly raise: number
  /** 그리기 목록 깊이 키 */
  readonly zKey: number
}

/** 몸 날리기 그림(vt40 날값) → 먼지 애니 — 0x434b4~0x434e0: 0x13 → 0 · 0x16 → 1 · 0x19 → 2 · 0x1c → 3 */
const DIVE_DUST_ANIM: Readonly<Record<number, number>> = { 0x13: 0, 0x16: 1, 0x19: 2, 0x1c: 3 }
/** 0x43714 — +0xb0 || +0xb4 > 0 */
const CATCH_DUST_ANIM = 4
/** 0x4379c — +0xb4 > 0 이면 머리 위 고리 (y − 10) */
const DIZZY_ANIM = 15
const DIZZY_RAISE = 10
/** 0x43818 · 0x438c4 — "!" (y − 40) */
const ALERT_ANIM = 13
const ALERT_RAISE = 40
/** 0x43b20 — 0x9ff40 방향 1~4 → 애니 5 · 6 · 8 · 7 */
const SLIDE_DUST_ANIMS = [5, 6, 8, 7] as const

/**
 * 야수 한 명의 부착 효과 (그리기 0x43278 의 야수 고리 안, 야수 그림 0x79b49 바로 뒤 — 직접 뜬 것).
 * ```
 * 434a2  vte0() = 동작 ∈ {8..0xb}(몸 날리기) 이면 vt40 그림 0x13/0x16/0x19/0x1c → 애니 0/1/2/3 을 (x, y) 에
 * 43546  달리기 먼지 자국 (`stepDustTrail`) — 0xbe8d5 프레임
 * 43714  +0xb0(바이트) || +0xb4 > 0 → 애니 4 를 (x, y)
 * 4379c  +0xb4 > 0 → 애니 15 를 (x, y − 10) 그리고 **끝**(아래 "!" 둘을 건너뛴다)
 * 43818  아니면 +0xb8 > 0 → 애니 13 "!" 를 (x, y − 40)     ; == 6 이면 기록 +0x2e · 0xa755d(3) · 소리 29 — 그림 밖 몫
 * 438c4  아니면 +0xc0 > 0 → 애니 13 "!" 를 (x, y − 40)     ; == 4 이면 기록 +0x2e · 0xa755d(3)
 * ```
 * 모두 깊이 키는 야수 z(+0x28)다. 먼지 자국만 그 자국 점의 z 다.
 */
export function fielderEffectMarksOf(fielder: DefenseFielder): PlayerEffectMark[] {
  const marks: PlayerEffectMark[] = []
  const at = (key: string, kind: 'anim' | 'frame', index: number, raise = 0): PlayerEffectMark => ({
    key: `f${fielder.slot}-${key}`,
    kind,
    index,
    x: fielder.x,
    z: fielder.z,
    raise,
    zKey: fielder.z,
  })
  if (fielder.action >= FIELDER_ACTION.diveDown && fielder.action <= FIELDER_ACTION.diveRight) {
    const anim = DIVE_DUST_ANIM[fielderActionFrameOf(fielder.action, fielder.actionTick)]
    if (anim !== undefined) marks.push(at('dive', 'anim', anim))
  }
  const trail = fielder.dustTrail ?? null
  if (trail !== null) {
    marks.push({ key: `f${fielder.slot}-trail`, kind: 'frame', index: trail.frame, x: trail.x, z: trail.z, raise: 0, zKey: trail.z })
  }
  const lockTicks = fielder.lockTicks ?? 0
  if (fielder.catchFlag === true || lockTicks > 0) marks.push(at('catch', 'anim', CATCH_DUST_ANIM))
  if (lockTicks > 0) marks.push(at('dizzy', 'anim', DIZZY_ANIM, DIZZY_RAISE))
  else if ((fielder.fumbleTicks ?? 0) > 0) marks.push(at('alert', 'anim', ALERT_ANIM, ALERT_RAISE))
  else if ((fielder.throwErrorTicks ?? 0) > 0) marks.push(at('alert', 'anim', ALERT_ANIM, ALERT_RAISE))
  return marks
}

/**
 * 주자 슬라이딩 먼지 (그리기 0x43a0c 의 0x43b0a~0x43baa): 0x9ff39(+0xb8) 이면 방향 0x9ff40 → 애니를 주자 (x, y) 에.
 * 깊이 키는 주자 z 이고 주자 그림(0x79d11)은 z + 1 로 넣는다(43aec) — 먼지가 주자 **밑**이다 (웹 주자 키도 z + 1 — DefenseScreen).
 */
export function runnerEffectMarksOf(runner: DefenseRunner): PlayerEffectMark[] {
  const direction = runner.slideDirection ?? 0
  if (direction < 1 || direction > 4) return []
  return [
    {
      key: `r${runner.index}-slide`,
      kind: 'anim',
      index: SLIDE_DUST_ANIMS[direction - 1],
      x: runner.x,
      z: runner.z,
      raise: 0,
      zKey: runner.z,
    },
  ]
}

/** 한 스냅샷의 부착 효과 전부 — 야수 9명(0x43278) 뒤 주자(0x43a0c) 차례 */
export function playerEffectMarksOf(state: DefenseViewState): PlayerEffectMark[] {
  return [
    ...state.fielders.flatMap(fielderEffectMarksOf),
    ...state.runners.filter((runner) => runner.isVisible !== false).flatMap(runnerEffectMarksOf),
  ]
}
