import type { GameState } from '@/entities/game/model/gameState'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { AdvanceResult } from '@/entities/game/model/baseState'
import { recordLineupPlay } from '@/entities/game/model/quickLineup'
import { laserThrowOutRecordOf, multiOutPlayRecordIdsOf, strikeoutRecordIdsOf, threePitchInningRecordIdsOf } from '@/entities/game/model/gameRecords'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { baserunnerAllowedOfFates, baserunnerAllowedOfPlay } from '@/features/defense-play/model/runnerFates'
import { type PitcherGameRecord, recordBatterFaced, recordHitByPitch } from '@/entities/pitcher-career/model/pitcherGameRecord'
import type { PitcherEvaluationRecord } from '@/features/play-pitcher-game/model/pitcherGameEvaluation'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/** `applyDefensivePlay` 의 state[0x88] — 이 정산의 주자 목록 마지막 원소가 안 끝났으면 (a8c5c) */
export function teamBaserunnerAllowedAfterPlayOf(
  progress: PitcherGameProgress,
  before: GameState,
  outcome: AtBatOutcome,
  mine: boolean,
  defensePlay: DefensePlayResult | null,
  quickAdvance: AdvanceResult | undefined,
  settledRunnerPlay: DefensePlayResult | undefined,
): boolean {
  return (
    progress.teamBaserunnerAllowed ||
    (settledRunnerPlay !== undefined
      ? baserunnerAllowedOfFates(settledRunnerPlay.runnerFates)
      : baserunnerAllowedOfPlay(before.bases, outcome, mine, defensePlay, quickAdvance))
  )
}

/** `applyDefensivePlay` 의 상대 타순 칸 기록 — 정산 0xa8024 의 결과 링 · 타석 +0x14 · 안타 +0x12 · 홈런 +0x13 */
export function opponentLineupAfterPlayOf(
  progress: PitcherGameProgress,
  slot: number,
  outcome: AtBatOutcome,
  play: {
    readonly stealPlaySettlement: boolean
    readonly quickAdvance: AdvanceResult | undefined
    readonly homeRunCounted: boolean
    readonly hit: boolean
  },
): Pick<PitcherGameProgress, 'opponentLineup' | 'opponentBatterLogs'> {
  const { stealPlaySettlement, quickAdvance, homeRunCounted, hit } = play
  const previousLog = progress.opponentBatterLogs[slot] ?? { hits: 0, homeRuns: 0 }
  return {
    // 정산 0xa8024 — 타순 칸 기록(타석 +0x14 · 안타 +0x12 · 홈런 +0x13)이 CPU 대타 0xac228 의 재료다
    // 종류 5 정산은 a8a04 · a8ac8 이 결과 링 · 타석 +0x14 를 건너뛴다
    opponentLineup: stealPlaySettlement
      ? progress.opponentLineup
      : recordLineupPlay(progress.opponentLineup, slot, outcome, { quickEngine: quickAdvance !== undefined, homeRunCounted }),
    opponentBatterLogs: {
      ...progress.opponentBatterLogs,
      [slot]: {
        hits: previousLog.hits + (hit ? 1 : 0),
        homeRuns: previousLog.homeRuns + (homeRunCounted ? 1 : 0),
      },
    },
  }
}

/** `applyDefensivePlay` 의 내 투수 기록 R — 정산 0xa8024 · 0xa57f8 의 R+0x12c~+0x154 */
export function playedRecordOf(
  progress: PitcherGameProgress,
  play: {
    readonly mine: boolean
    readonly counts: boolean
    readonly hit: boolean
    readonly walk: boolean
    readonly outcome: AtBatOutcome
    readonly outsAdded: number
    readonly inningEnded: boolean
    readonly perfectInningFlag: boolean
    readonly stealPlaySettlement: boolean
  },
): PitcherEvaluationRecord {
  const { mine, counts, hit, walk, outcome, outsAdded, inningEnded, perfectInningFlag, stealPlaySettlement } = play
  return !mine
    ? progress.record
    : !counts
      ? // 게이트 밖인 코드 0x20(R+0x154 삼자범퇴 이닝)만 센다
        { ...progress.record, perfectInnings: progress.record.perfectInnings + (inningEnded && perfectInningFlag ? 1 : 0) }
      : {
          ...progress.record,
          hitsAllowed: progress.record.hitsAllowed + (hit ? 1 : 0),
          // R+0x134 — 정산 a8d4e (코드 0x18). 종류 5 정산은 a8d38 이 건너뛴다
          strikeouts: progress.record.strikeouts + (outcome.kind === '삼진' && !stealPlaySettlement ? 1 : 0),
          // R+0x13c — 삼진 콜 0xa7c4c · 아웃 콜 0xa7d0c 가 올린다(정산과 무관)
          outsRecorded: progress.record.outsRecorded + outsAdded,
          // R+0x144 은 볼넷만이다 — 코드 0x1c 는 state[5] > 3 일 때뿐(0xa8e04), 사구는 아래 R+0x148(0x1d)
          walksAllowed: progress.record.walksAllowed + (walk ? 1 : 0),
          // 연속 탈삼진 — 삼진이 아닌 타석이 끼면 끊긴다 (R+0x14c, 0xa619e). 종류 5 정산은 코드 0x18 을 안 지나 그대로다
          strikeoutCombo: stealPlaySettlement ? progress.record.strikeoutCombo : outcome.kind === '삼진' ? progress.record.strikeoutCombo + 1 : 0,
          // R+0x154 — 삼자범퇴 이닝 (S5 정정 4: "무안타" 가 아니라 아무도 안 내보낸 이닝이다)
          perfectInnings: progress.record.perfectInnings + (inningEnded && perfectInningFlag ? 1 : 0),
        }
}

/** `applyDefensivePlay` 가 들이는 기록달성 번호 — 삼진 16~23 · 필살송구 36 · 병살 26 · 삼중살 27 · 삼구 삼자범퇴 25 */
export function playRecordIdsOf(
  progress: PitcherGameProgress,
  play: {
    readonly strikeout: boolean
    readonly stealPlaySettlement: boolean
    readonly balls: number
    readonly strikeoutComboAtCall: number
    readonly moundStrikeouts: number
    readonly laserPlay: DefensePlayResult | undefined
    readonly settledOuts: number
    readonly droppedThirdStrike: boolean
    readonly inningEnded: boolean
    readonly outsAfterPlay: number
  },
): number[] {
  const { strikeout, stealPlaySettlement, balls, strikeoutComboAtCall, moundStrikeouts, laserPlay, settledOuts, droppedThirdStrike, inningEnded } =
    play
  // 삼진 계열 16·17(0xa7c4c) 과 18~23(0xa7998). 게이트는 "수비 팀이 사람 팀인가" 만 보므로
  // 동료 투수가 잡은 삼진도 우리 팀 기록으로 들어온다 (R8 1절).
  // 종류 5 정산은 a8d38 이 0xa7998(18~23)을 건너뛰어 16·17(삼진 콜)만 남는다 — 그 둘은 판 정산보다 먼저라 판을 먹일 때
  // (`applyPitcherArrival`) 24 앞에 이미 줬다
  const newRecordIds: number[] = !strikeout
    ? []
    : stealPlaySettlement
      ? []
      : [
          ...strikeoutRecordIdsOf({
            pitches: progress.atBatPitches,
            balls,
            comboCount: strikeoutComboAtCall,
            pitcherStrikeouts: moundStrikeouts,
          }),
        ]
  // 삼진 + 도루 판의 36 은 판을 먹일 때(`applyPitcherArrival`) 24 앞에 이미 줬다 — a80f8 이 a83de(24)보다 먼저다
  if (laserPlay !== undefined && !stealPlaySettlement) {
    newRecordIds.push(...laserThrowOutRecordOf({ laserThrowFlag: laserPlay.laserOutFlag, outsInPlay: settledOuts }).recordIds)
  }
  // 26 병살 · 27 삼중살 — a8e58 은 판 종류를 안 거른다. 게이트 0xa77f0 은 수비 팀이 사람이면 들인다.
  // 낫아웃은 [sp+0x30] == 2 여도 0xb6c3c(state[0x1a])가 26 을 막는다(a8e5e) — 27 은 막지 않는다
  newRecordIds.push(...multiOutPlayRecordIdsOf({ outsInPlay: settledOuts, strikeoutWhileRunning: droppedThirdStrike }))
  // 25 삼구 삼자범퇴 (0xa7d0c) — 반 이닝을 공 셋으로 3아웃
  if (inningEnded) {
    newRecordIds.push(...threePitchInningRecordIdsOf(progress.halfInningPitches, play.outsAfterPlay))
  }
  return newRecordIds
}

/**
 * 정산 0xa8024 가 내 투수 기록 R 에 남기는 것 — R+0x138 타자 수(0xa8db0) 뒤 사구면 R+0x148 (코드 0x1d, 0xa8e2a).
 * 두 코드 다 "수비팀 현재 투수가 본인" 필터(0x14~0x1f)를 지나므로 내가 던진 타석(`mine`)에서만 부른다.
 */
export function pitcherRecordAfterPlay(record: PitcherGameRecord, hitByPitch: boolean): PitcherGameRecord {
  const faced = recordBatterFaced(record, 0)
  return hitByPitch ? recordHitByPitch(faced).record : faced
}
