import { PITCHER_LEAGUE_MODE, type AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import { lapPlayClock } from '@/entities/collection/model/playClock'
import type { PitcherGameOptions, PitcherGameSummary } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { liveGameSidesOf, setLiveGameInningIndex, setLiveGameSides } from '@/shared/lib/liveGameState/liveGameState'

/**
 * 정산 0x4ea0c 의 통계 세 줄 — 기록 달성 G 를 저장 G 에 더한 뒤 0x4ec82 `0x22c7d(액수, 모드 3)` 로 획득 GP 통계에 · 0x4ec8a
 * `0x22e10` 이 이번 경기 기록 배열 40칸을 연감 달성 횟수 [+4+n] 에 (e48e922) · 끝 0x4f54a `0x4e8b0` 이 장면 시작(또는 지난 누계)부터
 * 지난 시간을 모드 칸 플레이 시간에 (0x22efc). 모드를 가리지 않는다(국가대항전 경기도 같다)
 */
export function recordSettlementStats(recordStat: (event: AnnalsStatEvent) => void, summary: PitcherGameSummary, gamePointReward: number): void {
  recordStat({ kind: 'G획득', mode: PITCHER_LEAGUE_MODE, amount: gamePointReward })
  recordStat({ kind: '기록달성', recordIds: summary.recordIds ?? [] })
  recordStat({ kind: '플레이시간', mode: PITCHER_LEAGUE_MODE, elapsed: lapPlayClock() })
}

/**
 * 전역 경기 상태 +0x6b 에 이 경기 끝 이닝이 남는다 (이어하기 116 의 감독 글 38 판정이 본다) — 측별 팀 +0x28 · 점수 +0x7e 도
 * 남아 120 상세 창의 스킬 14 갈래(0xb5a28~)가 본다 (`isLiveGameFightingSpiritSituation`). 국가대항전 경기도 같다
 */
export function leaveLiveGameState(summary: PitcherGameSummary, options: PitcherGameOptions): void {
  setLiveGameInningIndex(summary.endedInningIndex ?? 0)
  setLiveGameSides(liveGameSidesOf(options, { ...summary, playerSide: options.playerSide }))
}
