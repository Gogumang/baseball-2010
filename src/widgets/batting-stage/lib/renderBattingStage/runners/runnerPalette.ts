/** 루상 주자(defender) 그림의 공격 팀 벌 — 그리기(`drawBaseRunners`)와 미리 칠하기가 같은 벌을 쓴다 */
import { frameAnimations, warmRecoloredFrames } from '@/widgets/batting-stage/lib/spriteLoader'
import type { RecolorFrame, StageAnimationEntry } from '@/widgets/batting-stage/lib/spriteLoader'
import { RUNNER_FRAMES, type BaseKey } from '@/widgets/batting-stage/lib/baseRunners'
import type { HudState } from '@/widgets/batting-stage/lib/renderHud'

/** 공격 팀 번호 — 초(측 0) · 말(측 1) 중 공격 측이 사람 측(`playerSide`, 기본 1)이면 우리 팀 */
export function offenseTeamIdOf(hud: HudState): number | null {
  const offenseSide = hud.half === '말' ? 1 : 0
  const teamId = offenseSide === (hud.playerSide ?? 1) ? hud.ourTeamId : hud.opponentTeamId
  return teamId ?? null
}

/** defender.mpl 은 팀 번호가 곧 벌 번호(15벌) — 범위 밖이면 구운 벌 (`pages/defense` 의 `defenderPaletteIndexOf` 와 같은 규칙) */
const DEFENDER_TEAM_COUNT = 15
export function runnerPaletteIndexOf(teamId: number | null): number | null {
  if (teamId === null || !Number.isInteger(teamId) || teamId < 0 || teamId >= DEFENDER_TEAM_COUNT) return null
  return teamId
}

/** 주자 애니 0 · 1 · 2 가 1 · 2 · 3 루 (애니 3 부터는 루 주자가 아니다) */
export const RUNNER_BASE_OF_ANIMATION: readonly BaseKey[] = ['first', 'second', 'third']

/**
 * 보통 주자(defender, 공격 팀 벌)가 그릴 수 있는 칸 — 애니 0 · 1 · 2 의 프레임 전부 — 를 미리 칠한다(`warmRecoloredFrames`).
 * 주자가 처음 서는 그림 · 처음 흔드는 칸에 구운 벌이 한 박자 비치지 않게. 애니 표가 아직이면 다음 그림에 다시 본다
 */
export function warmRunnerRecolors(paletteIndex: number | null): void {
  if (paletteIndex === null) return
  const animations = frameAnimations(RUNNER_FRAMES)
  if (animations === null) return
  warmRecoloredFrames(`runner|${paletteIndex}`, () => runnerRecolorFramesOf(animations, paletteIndex))
}

/** 주자 애니 0 · 1 · 2(1 · 2 · 3루)의 칸 전부를 공격 팀 벌로 — 같은 칸은 한 번 */
export function runnerRecolorFramesOf(animations: readonly (readonly StageAnimationEntry[])[], paletteIndex: number): RecolorFrame[] {
  const frames = new Set(RUNNER_BASE_OF_ANIMATION.flatMap((_, animation) => (animations[animation] ?? []).map((entry) => entry.frame)))
  return [...frames].map((frame) => ({ folder: RUNNER_FRAMES, frame, paletteIndex }))
}
