import { type PlayerSide, PLAYER_SIDE_LAST_BAT, ourHalfOf } from '@/entities/game/model/gameState'
import { type MatchProgressSettings, FULL_PLAY_SETTINGS, isHumanControlled } from '@/features/play-team-game/model/matchSettings'
import { AUTO_PROGRESS_LAST_INNING_INDEX, isVersusMode } from '@/features/play-team-game/model/teamGameFlow/autoProgress/autoProgressCost'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/** 기본 측 — 일반모드는 빠른실행이 반반으로 뽑지만(0x3123c) 화면이 없으면 후공으로 둔다 */
export const DEFAULT_PLAYER_SIDE: PlayerSide = PLAYER_SIDE_LAST_BAT

/* ── 지금 누구 차례인가 ───────────────────────────────────────────────────────── */

export function settingsOf(progress: TeamGameProgress): MatchProgressSettings {
  return progress.options.settings ?? FULL_PLAY_SETTINGS
}

/** 우리 팀이 공격 중인가 (측이 정한다 — 측 0 선공 = 초 · 측 1 후공 = 말) */
export function isOurOffense(progress: TeamGameProgress): boolean {
  return progress.game.half === ourHalfOf(progress.game)
}

/**
 * 지금 타석을 사람이 조작하는가 (`0xc1e04`).
 * 팀 경기에서 사람이 조작하는 팀은 우리 팀 하나뿐이라, 공격 팀·수비 팀 판정이 곧 "우리 차례인가" 다.
 */
export function isHumanTurn(progress: TeamGameProgress): boolean {
  if (progress.game.isFinished || isScenePlaying(progress)) return false
  const flag = progress.autoProgressFlag ?? null
  if (flag !== null) return isHumanAfterAutoProgress(progress, flag)
  const ours = isOurOffense(progress)
  return isHumanControlled(settingsOf(progress), {
    mode: progress.options.mode,
    humanControlsOffense: ours,
    humanControlsDefense: !ours,
    bases: progress.game.bases,
    // 원본 이닝은 0-기준이다 (state+0x6b)
    inningIndex: progress.game.inning - 1,
    battingOrderIndex: ours ? progress.game.battingOrderIndex : progress.opponentOrderIndex,
  })
}

/**
 * 장면이 아직 돌고 있어 다음 공이 안 나가는가.
 * - 수비 진행 중(원본 상태 0x17) — 원본도 공이 멈출 때까지 0xe·0xf 로 돌아가지 않는다. 사람 수비의 주자 판도 같다.
 * - 벤치 클리어링 연출(0x1e).
 * - 자동진행 중계(상태 0x21) — 화면이 `stepAutoRelay` 로 넘길 때까지.
 */
function isScenePlaying(progress: TeamGameProgress): boolean {
  return (
    progress.pendingDefensePlay !== null || progress.pendingRunnerPlay != null || progress.pendingBenchClearing !== null || progress.autoRelay != null
  )
}

/** 0xc1e04 — 모드 1·2(c1f20): sim+0x9f → 사람 · sim+0xa0 → 자동. 모드 8·9(c1f04): 0-기준 이닝 > 5 → 사람이 먼저다 */
function isHumanAfterAutoProgress(progress: TeamGameProgress, flag: NonNullable<TeamGameProgress['autoProgressFlag']>): boolean {
  if (isVersusMode(progress.options.mode) && progress.game.inning - 1 > AUTO_PROGRESS_LAST_INNING_INDEX) return true
  return flag === 'stopped'
}

/** 사람이 **칠** 차례인가 */
export function isBatterTurn(progress: TeamGameProgress): boolean {
  return isHumanTurn(progress) && isOurOffense(progress)
}

/** 사람이 **던질** 차례인가 */
export function isPitchTurn(progress: TeamGameProgress): boolean {
  return isHumanTurn(progress) && !isOurOffense(progress)
}
