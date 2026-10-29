import { ACE_PITCH_LAST_STEPS, ACE_PITCH_STEP_FRAMES, IDLE_FRAMES, PITCH_STEP_FRAMES } from '@/widgets/batting-stage/lib/stageScenery/pitchStepTables'
import { aceRowOf, pitchStepAt } from '@/widgets/batting-stage/lib/stageScenery/pitchSteps'
import type { PitcherAnimation } from '@/widgets/batting-stage/lib/stageScenery/pitcherAnimation'

/**
 * 투수 그림 객체가 그릴 수 있는 **바탕 프레임 전부** (자세 0x9e0b8) — 미리 받기가 쓴다.
 * 평범한 투수는 폼 세 줄의 투구 단계 + 대기 동작, 마투수는 그 순번 줄의 단계 0..마지막 (대기 동작은 0 이다).
 * 평범한 투수의 덧그림(+0x16)은 `pitcherLayersOf` 가 붙인다.
 */
export function pitcherPoseFramesOf(aceOrder?: number | null): number[] {
  const row = aceRowOf(aceOrder)
  const frames =
    row === null ? [...PITCH_STEP_FRAMES.flat(), ...IDLE_FRAMES] : [0, ...ACE_PITCH_STEP_FRAMES[row].slice(0, ACE_PITCH_LAST_STEPS[row] + 1)]
  return [...new Set(frames)].sort((a, b) => a - b)
}

/** 0x9e0b8 — 지금 상태의 그림 프레임. 마투수는 ace/pitcher_*.pzx, 아니면 pitcher.pzx 의 번호다 */
export function pitcherPoseOf(animation: PitcherAnimation, form: number, aceOrder?: number | null): number {
  const row = aceRowOf(aceOrder)
  if (animation.state === 2) return row === null ? (IDLE_FRAMES[animation.step] ?? 0) : 0
  if (row !== null) return ACE_PITCH_STEP_FRAMES[row][animation.step] ?? 0
  return formPoseOf(form, animation.step)
}

/** 평범한 투수의 투구 자세 — 0x9e0e2 `cmp r3, #5 / bhi` 로 폼이 0~5 밖이면 0 */
function formPoseOf(form: number, step: number): number {
  if (form < 0 || form > 5) return 0
  return PITCH_STEP_FRAMES[form >> 1][step] ?? 0
}

/** 평범한 투수 상태 1 의 자세 (폼 표) */
export function pitcherFrameAt(form: number, tick: number): number {
  return pitcherPoseOf({ state: 1, step: pitchStepAt(tick) }, form)
}

/**
 * 투수 덧그림 — 같은 pitcher.pzx 를 **프레임 f + 22 로 한 번 더** 겹쳐 그린다 (확정).
 *
 * 투수 그림 객체의 그리기 0x79524 는 겹칠 판 6개를 쌓아 두고 한 번에 그린다
 * (0x7961e~0x79692, 칸은 L-sound-effects.md 3절과 같다):
 *   0 바탕 pzx [+0x0c] 프레임 f · 1 머리 아이템 [+0x1c] · 2 몸 아이템 [+0x24]
 *   **3 바탕 pzx 를 다시, 프레임 `f + 0x16`** (0x79662 `adds r3,r6,#0x16` → [sp+0x40], 0x7966a [sp+0x58] = [+0x0c])
 *   4 손 아이템 [+0x20] · 5 다리 아이템 [+0x28]
 * 아이템 칸은 obj+0x3e+부위 가 음수면 건너뛰지만 3번 칸은 **조건 없이** 늘 쌓인다.
 *
 * 그래서 pitcher.pzx 의 22~43 번 프레임은 깨진 그림이 아니라 **덧그림 전용**이다:
 *   대기 0·1·2 → 22·23·24 글러브 안 공 · 와인드업 3·4·5·6 → 25·26·27·28 몸통과 던지는 팔
 *   9 → 31 팔 잔상 · 18 → 40 잔상 · 좌완 대기 19·20·21 → 41·42·43 공
 *   그 밖(7·8·10~17)은 29·32~39 빈 프레임이라 아무것도 안 더해진다.
 * 타자가 쓰는 앞몸통 덧그림(`batterLayers.ts` FRONT_OFFSETS)과 같은 방식이다.
 */
export const PITCHER_OVERLAY_FRAME_OFFSET = 0x16
