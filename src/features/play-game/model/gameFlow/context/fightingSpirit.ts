import { isFightingSpiritSituationOf, inGameFightingSpiritStateOf } from '@/shared/lib/liveGameState/liveGameState'
import type { GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * **스킬 14(투지) 갈래의 경기 상태** (0xb570c b5a4c~b5a66) — 경기 장면은 전역 상태 [0x1552d0c] 자체를 굴리므로 지금 판의 이닝(+0x6b) ·
 * 측별 팀(+0x28, 셋업 0xb6bd4) · 점수(+0x7e, 득점 0xb6a9c)를 본다. `runsThisHalf` 는 자동진행 간이 엔진이 굴리는 중인 이번 반 이닝 득점
 * (`offenseIsOurs` 쪽). 팀은 0xb570c 첫 인자 = `0xb8680(팀 객체)` 레코드 +0 이다 (A-23)
 */
export function gameFightingSpiritOf(
  progress: GameProgress,
  teamId: number,
  extraRuns?: { readonly runs: number; readonly offenseIsOurs: boolean },
): boolean {
  return isFightingSpiritSituationOf(inGameFightingSpiritStateOf(progress, progress.game, extraRuns), teamId)
}
