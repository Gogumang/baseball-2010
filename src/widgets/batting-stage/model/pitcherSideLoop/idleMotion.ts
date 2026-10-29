/** 투수 대기 동작(0x9e004) — 0xf 진입 · 빈 구질 칸 키가 처음부터 돌리고, 0xf 를 떠나면 굳는다 */
import type { PitchInputOverlay } from '@/widgets/batting-stage/lib/pitchInputOverlay'
import type { PitcherSideLoop } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideLoop'
import type { PitcherSideFrame } from '@/widgets/batting-stage/model/pitcherSideLoop/pitcherSideFrame'

/** 이 틀의 입력 UI 상태 */
export interface PitchInputNow {
  /** 장면 안에 그릴 입력 UI — 공이 날거나 0x12 인 동안은 없다 */
  readonly pitchInput: PitchInputOverlay | null
  /** 0x4b5b4 가 보는 상태 — 쉬는 대기 · 공이 나는 동안은 null */
  readonly inputKind: PitchInputOverlay['kind'] | null
  /** 상태 0xf(구질 목록) */
  readonly isStateF: boolean
  /** 이 틀에 0xf 에 들었다 */
  readonly entersStateF: boolean
}

export function pitchInputNowOf(loop: PitcherSideLoop, frame: PitcherSideFrame): PitchInputNow {
  const isIdle = frame.stage.phase.kind === '대기'
  const overlay = isIdle ? (frame.current.inputOverlayRef?.current ?? null) : null
  // 0x4b5b4 — 상태 0xf(구질 목록) · 0x10(조준) · 0x11(게이지 · 공이 나는 동안)만 그린다(4b5ca)
  const inputKind = frame.current.isPaused ? null : (overlay?.kind ?? null)
  const isStateF = inputKind === '구질'
  return { pitchInput: overlay, inputKind, isStateF, entersStateF: isStateF && !loop.wasSkillPanelStateF }
}

/** 이 틀의 대기 동작 칸을 고친다 */
export function applyIdleMotion(loop: PitcherSideLoop, frame: PitcherSideFrame, input: PitchInputNow): void {
  // 0xf 진입 0x3d954 → 0x35650 → 0x340c0 — 투수 그림 객체를 상태 0 으로 (진입 표가 키보다 먼저 돈다)
  if (input.entersStateF) {
    loop.idleStartTick = null
    loop.idleEndTick = null
  }
  // 구질 목록 부품이 내려가면(0x10 조준 · 0xb 교체 창 · 공) 다음 0xf 의 부품은 누름 표지를 0 부터 다시 센다 — 본 표지도 0 으로.
  // 안 그러면 0xf → 0xb('#') → 0xe → 0xf 길 뒤 첫 빈 칸 키가 앞 0xf 의 표지와 같은 수라 대기 동작(9dff8(…, 2))을 놓친다
  if (frame.current.inputOverlayRef?.current?.kind !== '구질') loop.seenIdlePress = 0
  applyIdlePress(loop, frame.nowTick, input.pitchInput)
  // 0x9e004 는 0xf 갱신 0x39c1c 에서만 대기 동작을 센다 — 0xf 를 떠난 그림의 앞 틱에서 굳는다
  if (loop.idleStartTick !== null && loop.idleEndTick === null && !input.isStateF) {
    loop.idleEndTick = Math.max(loop.idleStartTick, frame.nowTick - 1)
  }
}

/** 0x50de8 — 구질 목록(0xf)의 빈 칸 키. 누를 때마다 처음부터 한 바퀴(9dff8 이 단계 · 틱을 0 으로) */
function applyIdlePress(loop: PitcherSideLoop, nowTick: number, pitchInput: PitchInputOverlay | null): void {
  const idlePress = pitchInput?.kind === '구질' ? (pitchInput.pitcherIdlePress ?? 0) : 0
  if (idlePress === 0 || idlePress === loop.seenIdlePress) return
  loop.seenIdlePress = idlePress
  loop.idleStartTick = nowTick
  loop.idleEndTick = null
}
