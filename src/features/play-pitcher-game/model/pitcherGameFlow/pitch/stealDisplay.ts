import type { StealBase } from '@/entities/fielding/model/stealStart'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/** 판정 입력(st[0x14 + i])만 거둔다 — 표시(`stealDisplay`)는 0xf 진입 · 타구 판 시작까지 남는다 */
export function withoutSteal(progress: PitcherGameProgress): PitcherGameProgress {
  return progress.stealingFrom.length === 0 ? progress : { ...progress, stealingFrom: [] }
}

/** 판정 입력과 표시를 함께 지운다 — 타구 판(종류 1) 시작 리드 0x3d7b8 3d8c6~3d8d2 */
export function withoutStealDisplay(progress: PitcherGameProgress): PitcherGameProgress {
  const cleared = withoutSteal(progress)
  return (cleared.stealDisplay ?? null) === null ? cleared : { ...cleared, stealDisplay: null }
}

/** 0xf 진입 3d966~3d976 — 표시 칸이 지워졌다고 적는다(화면은 공이 날거나 0x12 인 동안 계속 숨긴다) */
export function withStealDisplayCleared(progress: PitcherGameProgress): PitcherGameProgress {
  const display = progress.stealDisplay ?? null
  if (display === null || display.selectionEntered) return progress
  return { ...progress, stealDisplay: { ...display, selectionEntered: true } }
}

/**
 * **투구 화면이 루에 안 그릴 주자의 루** — `stealDisplay` 를 화면의 "공이 날거나 0x12 인 동안"(원본 0x11 · 0x12)과 묶는다.
 * 0xf 진입이 이미 지웠어도 그 진입은 원본에서 0x12 뒤라 그동안은 숨긴다.
 */
export function hiddenStealBasesOf(progress: PitcherGameProgress, isPitchSceneBusy: boolean): readonly StealBase[] {
  const display = progress.stealDisplay ?? null
  if (display === null) return []
  return !display.selectionEntered || isPitchSceneBusy ? display.bases : []
}
