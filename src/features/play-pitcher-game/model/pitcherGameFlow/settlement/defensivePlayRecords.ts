import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { recordLineupPlay } from '@/entities/game/model/quickLineup'
import { laserThrowOutRecordOf, multiOutPlayRecordIdsOf, strikeoutRecordIdsOf, threePitchInningRecordIdsOf } from '@/entities/game/model/gameRecords'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { baserunnerAllowedOfFates, baserunnerAllowedOfPlay } from '@/features/defense-play/model/runnerFates'
import { type PitcherGameRecord, recordBatterFaced, recordHitByPitch } from '@/entities/pitcher-career/model/pitcherGameRecord'
import type { PitcherEvaluationRecord } from '@/features/play-pitcher-game/model/pitcherGameEvaluation'
import type { DefensivePlayFacts, DefensivePlaySources } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/defensivePlayFacts'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/** state[0x88] — 이 정산의 주자 목록 마지막 원소가 안 끝났으면 (a8c5c). 삼진과 한 정산인 주자 판은 그 판의 목록이다 */
export function teamBaserunnerAllowedAfterPlayOf(
  progress: PitcherGameProgress,
  facts: DefensivePlayFacts,
  outcome: AtBatOutcome,
  sources: DefensivePlaySources,
): boolean {
  if (progress.teamBaserunnerAllowed) return true
  if (sources.settledRunnerPlay !== undefined) return baserunnerAllowedOfFates(sources.settledRunnerPlay.runnerFates)
  return baserunnerAllowedOfPlay(facts.before.bases, outcome, facts.mine, sources.defensePlay, sources.quick?.advance)
}

/** 상대 타순 칸 기록 — 정산 0xa8024 의 결과 링 · 타석 +0x14 · 안타 +0x12 · 홈런 +0x13 */
export function opponentLineupAfterPlayOf(
  progress: PitcherGameProgress,
  facts: DefensivePlayFacts,
  outcome: AtBatOutcome,
  quickEngine: boolean,
): Pick<PitcherGameProgress, 'opponentLineup' | 'opponentBatterLogs'> {
  const { slot, homeRunCounted, hit } = facts
  const previousLog = progress.opponentBatterLogs[slot] ?? { hits: 0, homeRuns: 0 }
  return {
    // 정산 0xa8024 — 타순 칸 기록(타석 +0x14 · 안타 +0x12 · 홈런 +0x13)이 CPU 대타 0xac228 의 재료다
    // 종류 5 정산은 a8a04 · a8ac8 이 결과 링 · 타석 +0x14 를 건너뛴다
    opponentLineup: facts.stealPlaySettlement
      ? progress.opponentLineup
      : recordLineupPlay(progress.opponentLineup, slot, outcome, { quickEngine, homeRunCounted }),
    opponentBatterLogs: {
      ...progress.opponentBatterLogs,
      [slot]: {
        hits: previousLog.hits + (hit ? 1 : 0),
        homeRuns: previousLog.homeRuns + (homeRunCounted ? 1 : 0),
      },
    },
  }
}

/** 내 투수 기록 R — 정산 0xa8024 · 0xa57f8 의 R+0x12c~+0x154. 내가 던진 타석만 센다 */
export function playedRecordOf(progress: PitcherGameProgress, facts: DefensivePlayFacts, outcome: AtBatOutcome): PitcherEvaluationRecord {
  const { record } = progress
  if (!facts.mine) return record
  // 게이트 밖인 코드 0x20(R+0x154 삼자범퇴 이닝)만 센다
  if (!facts.counts) return { ...record, perfectInnings: perfectInningsAfterOf(record, facts) }
  return {
    ...record,
    hitsAllowed: record.hitsAllowed + (facts.hit ? 1 : 0),
    // R+0x134 — 정산 a8d4e (코드 0x18). 종류 5 정산은 a8d38 이 건너뛴다
    strikeouts: record.strikeouts + (outcome.kind === '삼진' && !facts.stealPlaySettlement ? 1 : 0),
    // R+0x13c — 삼진 콜 0xa7c4c · 아웃 콜 0xa7d0c 가 올린다(정산과 무관)
    outsRecorded: record.outsRecorded + facts.applied.outsAdded,
    // R+0x144 은 볼넷만이다 — 코드 0x1c 는 state[5] > 3 일 때뿐(0xa8e04), 사구는 아래 R+0x148(0x1d)
    walksAllowed: record.walksAllowed + (facts.walk ? 1 : 0),
    strikeoutCombo: recordStrikeoutComboAfterOf(record, facts, outcome),
    perfectInnings: perfectInningsAfterOf(record, facts),
  }
}

/** R+0x154 — 삼자범퇴 이닝 (S5 정정 4: "무안타" 가 아니라 아무도 안 내보낸 이닝이다) */
function perfectInningsAfterOf(record: PitcherEvaluationRecord, facts: DefensivePlayFacts): number {
  return record.perfectInnings + (facts.inningEnded && facts.perfectInningFlag ? 1 : 0)
}

/** 연속 탈삼진 — 삼진이 아닌 타석이 끼면 끊긴다 (R+0x14c, 0xa619e). 종류 5 정산은 코드 0x18 을 안 지나 그대로다 */
function recordStrikeoutComboAfterOf(record: PitcherEvaluationRecord, facts: DefensivePlayFacts, outcome: AtBatOutcome): number {
  if (facts.stealPlaySettlement) return record.strikeoutCombo
  return outcome.kind === '삼진' ? record.strikeoutCombo + 1 : 0
}

/** 기록달성 번호를 고르는 데 더 드는 값 — 0xb8cec 의 마운드 투수 R[0]·R[1] 과 필살송구 판 */
export interface PlayRecordCounters {
  readonly balls: number
  /** 삼진 콜 0xa7c4c 가 올린 R[1] — 18~23 판정 0xa7998(a8d5a)은 이 값을 본다 */
  readonly strikeoutComboAtCall: number
  readonly moundStrikeouts: number
  /** state[0x8b] 를 세운 판 — 이 타석의 판, 없으면 삼진과 한 정산인 주자 판 */
  readonly laserPlay: DefensePlayResult | undefined
}

/** 들이는 기록달성 번호 — 삼진 16~23 · 필살송구 36 · 병살 26 · 삼중살 27 · 삼구 삼자범퇴 25 */
export function playRecordIdsOf(progress: PitcherGameProgress, facts: DefensivePlayFacts, counters: PlayRecordCounters): number[] {
  const recordIds = strikeoutPlayRecordIdsOf(progress, facts, counters)
  // 삼진 + 도루 판의 36 은 판을 먹일 때(`applyPitcherArrival`) 24 앞에 이미 줬다 — a80f8 이 a83de(24)보다 먼저다
  if (counters.laserPlay !== undefined && !facts.stealPlaySettlement) {
    recordIds.push(...laserThrowOutRecordOf({ laserThrowFlag: counters.laserPlay.laserOutFlag, outsInPlay: facts.settledOuts }).recordIds)
  }
  // 26 병살 · 27 삼중살 — a8e58 은 판 종류를 안 거른다. 게이트 0xa77f0 은 수비 팀이 사람이면 들인다.
  // 낫아웃은 [sp+0x30] == 2 여도 0xb6c3c(state[0x1a])가 26 을 막는다(a8e5e) — 27 은 막지 않는다
  recordIds.push(...multiOutPlayRecordIdsOf({ outsInPlay: facts.settledOuts, strikeoutWhileRunning: facts.droppedThirdStrike }))
  // 25 삼구 삼자범퇴 (0xa7d0c) — 반 이닝을 공 셋으로 3아웃
  if (facts.inningEnded) {
    recordIds.push(...threePitchInningRecordIdsOf(progress.halfInningPitches, facts.before.outs + facts.applied.outsAdded))
  }
  return recordIds
}

/**
 * 삼진 계열 16·17(0xa7c4c) 과 18~23(0xa7998). 게이트는 "수비 팀이 사람 팀인가" 만 보므로 동료 투수가 잡은 삼진도 우리 팀 기록으로
 * 들어온다 (R8 1절). 종류 5 정산은 a8d38 이 0xa7998(18~23)을 건너뛰어 16·17(삼진 콜)만 남는다 — 그 둘은 판 정산보다 먼저라 판을
 * 먹일 때(`applyPitcherArrival`) 24 앞에 이미 줬다
 */
function strikeoutPlayRecordIdsOf(progress: PitcherGameProgress, facts: DefensivePlayFacts, counters: PlayRecordCounters): number[] {
  if (!facts.strikeout || facts.stealPlaySettlement) return []
  return [
    ...strikeoutRecordIdsOf({
      pitches: progress.atBatPitches,
      balls: counters.balls,
      comboCount: counters.strikeoutComboAtCall,
      pitcherStrikeouts: counters.moundStrikeouts,
    }),
  ]
}

/**
 * 정산 0xa8024 가 내 투수 기록 R 에 남기는 것 — R+0x138 타자 수(0xa8db0) 뒤 사구면 R+0x148 (코드 0x1d, 0xa8e2a).
 * 두 코드 다 "수비팀 현재 투수가 본인" 필터(0x14~0x1f)를 지나므로 내가 던진 타석(`mine`)에서만 부른다.
 */
export function pitcherRecordAfterPlay(record: PitcherGameRecord, hitByPitch: boolean): PitcherGameRecord {
  const faced = recordBatterFaced(record, 0)
  return hitByPitch ? recordHitByPitch(faced).record : faced
}
