import { TEAM_GAME_MODE } from '@/features/play-team-game/model/gameAbilities'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/* ── 자동진행 (경기 중 메뉴 동작 4 = 0x3c60c → 하위 2 = 0x3c7d8) ─────────────── */

/** 대전모드(8·9) 자동진행 비용 (`3c67e: movs r2,#0x64`) */
export const AUTO_PROGRESS_COST_VERSUS = 100

/** 그 밖 모드의 자동진행 비용 (`3c694: movs r2,#0x1e`) */
export const AUTO_PROGRESS_COST = 30

/** 대전모드는 0-기준 이닝이 5 를 넘으면 거절한다 (`경기+0x6b > 5` → StrGAME[2]) */
export const AUTO_PROGRESS_LAST_INNING_INDEX = 5

/** 이 모드의 자동진행 G포인트 비용 */
export function autoProgressCostOf(mode: number): number {
  return mode === TEAM_GAME_MODE.대전 || mode === TEAM_GAME_MODE.대전이벤트 ? AUTO_PROGRESS_COST_VERSUS : AUTO_PROGRESS_COST
}

/** 대전모드인가 — 6회 제한과 100G 가 붙는 두 모드 */
export function isVersusMode(mode: number): boolean {
  return mode === TEAM_GAME_MODE.대전 || mode === TEAM_GAME_MODE.대전이벤트
}

/**
 * 지금 자동진행을 물어볼 수 있는가 — **대전모드는 6회까지만**이다 (`0x3c60c`).
 * 거짓이면 원본은 StrGAME[2]("6회까지만") 알림만 띄우고 끝낸다.
 */
export function canAutoProgress(progress: TeamGameProgress): boolean {
  if (progress.game.isFinished) return false
  if (!isVersusMode(progress.options.mode)) return true
  // 원본 이닝은 0-기준이다 (state+0x6b)
  return progress.game.inning - 1 <= AUTO_PROGRESS_LAST_INNING_INDEX
}
