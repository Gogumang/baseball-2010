import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { liveGameSidesOf, setLiveGameInningIndex, setLiveGameSides } from '@/shared/lib/liveGameState/liveGameState'
import { BATTER_LEAGUE_MODE, type AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import { lapPlayClock } from '@/entities/collection/model/playClock'

/**
 * 전역 경기 상태 +0x6b 에 이 경기 끝 이닝이 남는다(0xb6b6c) — 투수편 이어하기 116 의 감독 글 38 이 본다 (`liveGameState`).
 * 측별 팀 +0x28 · 점수 +0x7e 도 남는다 — 관리 화면 상세 창의 스킬 14 갈래(0xb5a28~)가 본다 (`isLiveGameFightingSpiritSituation`).
 * 정규 · 대회 경기 모두, 경기 중 나가기(상태 0x22 → 장면 0x103)도 지우지 않고 남긴다.
 */
export function leaveLiveGameState(progress: GameProgress): void {
  setLiveGameInningIndex(progress.game.inning - 1)
  setLiveGameSides(liveGameSidesOf(progress, progress.game))
}

/**
 * 정산 0x4ea0c 의 통계 셋 — 0x4ec82 `0x22c7d(G, 모드 4)` 획득 GP · 0x4ec8a `0x22e10` 기록 달성 횟수(이번 경기 기록 배열 40칸,
 * e48e922) · 끝 0x4f54a `0x4e8b0` 플레이 시간(장면 시작 또는 지난 누계부터, 0x22efc). 모드를 가리지 않는다
 */
export function recordSettlementStats(recordStat: (event: AnnalsStatEvent) => void, gamePoint: number, recordIds: readonly number[]): void {
  recordStat({ kind: 'G획득', mode: BATTER_LEAGUE_MODE, amount: gamePoint })
  recordStat({ kind: '기록달성', recordIds })
  recordStat({ kind: '플레이시간', mode: BATTER_LEAGUE_MODE, elapsed: lapPlayClock() })
}
