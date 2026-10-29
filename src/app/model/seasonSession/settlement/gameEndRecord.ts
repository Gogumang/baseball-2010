import type { TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { clearRepeatableSeen, tickAfterAnyGame } from '@/entities/season-mode/model/seasonEventFlow'
import { lapPlayClock } from '@/entities/collection/model/playClock'
import { SEASON_STAT_MODE } from '@/app/model/seasonSession/constants/seasonConstants'

/**
 * 경기 끝 0x4ea0c 의 기록 달성 G · 통계 — 모드가 5·6(미션)이 아니면 갈래를 가르기 전에 합 [scene+0x17f4] 를 저장 G 에 더하고(4ec5a)
 * 획득 GP(0x4ec82) · 기록달성 횟수(0x4ec8a `0x22e10`) · 플레이 시간(끝 0x4f54a `0x4e8b0` → 0x22efc) 차례로 적는다 (`useSettleGame`)
 */
export function recordSeasonGameEndStats(
  summary: TeamGameSummary,
  gainGamePoint: (amount: number) => void,
  recordStat: ((event: AnnalsStatEvent) => void) | undefined,
): void {
  const earned = summary.gamePoints ?? 0
  if (earned !== 0) gainGamePoint(earned)
  recordStat?.({ kind: 'G획득', mode: SEASON_STAT_MODE, amount: earned })
  recordStat?.({ kind: '기록달성', recordIds: summary.recordIds ?? [] })
  recordStat?.({ kind: '플레이시간', mode: SEASON_STAT_MODE, elapsed: lapPlayClock() })
}

/**
 * 경기 끝 꼬리 — 경기 중 올린 평판 16칸을 꽂고(갈래와 상관없이 남는다) 4f374~4f3b2 의 SR+0x54 · SR+0x7c 줄이기, 반복 이벤트 본 비트
 * 지우기(0x8ce94), 4f15a~4f19a 의 지난 경기 점수 두 칸(바이트 — 0xe9 기록 줄이 s8 로 읽는다)
 */
export function playedSeasonRecordOf(record: SeasonRecord, summary: TeamGameSummary): SeasonRecord {
  return clearRepeatableSeen(
    tickAfterAnyGame({
      ...record,
      gameRecord: summary.gameRecord,
      lastGameScore: (summary.ourScore << 24) >> 24,
      lastGameConceded: (summary.opponentScore << 24) >> 24,
    }),
  )
}
