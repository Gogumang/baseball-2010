import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { RunnerPitcherSettlement } from '@/entities/game/model/runnerPitchers'
import type { DefensivePlayFacts, DefensivePlaySources } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/defensivePlayFacts'
import {
  pitcherRecordAfterPlay,
  playedRecordOf,
  playRecordIdsOf,
} from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/defensivePlayRecords'
import { MY_PITCHER_SLOT } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import type { PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'
import { recordsAllowed } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/recordGates'

/**
 * 내 투수 칸 — R(0xa57f8) · 레코드 +0x20 ~ +0x2a · 0xb8cec 의 마운드 투수 R[0](삼진)·R[1](연속 삼진) · 기록달성 번호.
 * R[0]·R[1] 은 삼진 아닌 결과로 끝난 타석마다 콤보가 끊긴다 (R8 5-5).
 */
export function myPitcherAfterPlayOf(
  progress: PitcherGameProgress,
  facts: DefensivePlayFacts,
  outcome: AtBatOutcome,
  play: { readonly balls: number; readonly sources: DefensivePlaySources; readonly runnerSettlement: RunnerPitcherSettlement },
) {
  const chargedToMe = facts.counts ? play.runnerSettlement.charged.filter((pitcher: number) => pitcher === MY_PITCHER_SLOT).length : 0
  return {
    ...moundRecordsAfterPlayOf(progress, facts, play),
    ...myRecordAfterPlayOf(progress, facts, outcome, chargedToMe),
    ...mySeasonExtrasAfterPlayOf(progress, facts),
    runsAllowedByMe: progress.runsAllowedByMe + chargedToMe,
    // 레코드 +0x2a — 게이트 없이 마운드의 내 투수에게 (a8b58 · a8bd2)
    freePassesByMe: progress.freePassesByMe + (facts.mine && facts.freePass ? 1 : 0),
  }
}

/** 마운드 R[0]·R[1] 과 기록달성 번호 */
function moundRecordsAfterPlayOf(
  progress: PitcherGameProgress,
  facts: DefensivePlayFacts,
  play: { readonly balls: number; readonly sources: DefensivePlaySources },
) {
  const strikeouts = moundStrikeoutsAfterPlayOf(progress, facts)
  // 36 필살송구 아웃 — 정산 0xa8024(a80f8~a8116)은 모드를 안 가리고, 게이트 0xa77f0 은 수비 팀이 사람이면 36 을 들인다.
  // 표시 state[0x8b] 는 수비 화면 결과 판 0x46844 가 레이저 연출 뒤 코드 13 결과 판에서 세운다(`DefensePlayResult.laserOutFlag`)
  const laserPlay = play.sources.defensePlay ?? play.sources.settledRunnerPlay
  const newRecordIds = playRecordIdsOf(progress, facts, { balls: play.balls, ...strikeouts, laserPlay })
  return {
    moundStrikeouts: strikeouts.moundStrikeouts,
    moundStrikeoutCombo: strikeouts.moundStrikeoutCombo,
    recordIds: recordsAllowed(progress) ? [...progress.recordIds, ...newRecordIds] : progress.recordIds,
  }
}

/** R(평가 칸)과 레코드 칸(+0x20 · +0x26 · +0x2a 의 재료) */
function myRecordAfterPlayOf(progress: PitcherGameProgress, facts: DefensivePlayFacts, outcome: AtBatOutcome, chargedToMe: number) {
  const playedRecord = playedRecordOf(progress, facts, outcome)
  const countsBatterFaced = facts.mine && facts.counts && !facts.stealPlaySettlement
  return {
    record: chargedToMe > 0 ? { ...playedRecord, runsAllowedField: playedRecord.runsAllowedField + chargedToMe } : playedRecord,
    // 종류 5 정산은 a8d98 이 R+0x138(타자 수)을 건너뛴다 — 사구는 종류 5 와 겹치지 않는다(밀어내기 종류 2 로 덮인다)
    pitcherRecord: countsBatterFaced ? pitcherRecordAfterPlay(progress.pitcherRecord, facts.hitByPitch) : progress.pitcherRecord,
  }
}

/**
 * 시즌 레코드에 R 칸과 따로 더하는 몫 — 시즌 탈삼진 +0x26 은 판 종류를 안 보는 a8d00 몫(`stealPlayStrikeouts`),
 * 낫아웃은 a8cb0 +0x20 += [sp+0x30](삼진 사건 포함)이고 보정 −1 은 R+0x13c · R[3] 에만 (`seasonOutsExtra`)
 */
function mySeasonExtrasAfterPlayOf(
  progress: PitcherGameProgress,
  facts: DefensivePlayFacts,
): Pick<PitcherGameProgress, 'stealPlayStrikeouts' | 'seasonOutsExtra'> {
  if (!facts.mine || !facts.counts) return {}
  return {
    ...(facts.stealPlaySettlement && facts.strikeout ? { stealPlayStrikeouts: (progress.stealPlayStrikeouts ?? 0) + 1 } : {}),
    ...(facts.droppedThirdStrike ? { seasonOutsExtra: (progress.seasonOutsExtra ?? 0) + 1 } : {}),
  }
}

/** 0xb8cec R[0]·R[1] — 삼진 콜 0xa7c4c 가 올린 R[1] 을 정산 끝 a8fb2~a8ff8 이 낫아웃이면 끊는다(종류 4·5 는 건너뜀) */
function moundStrikeoutsAfterPlayOf(progress: PitcherGameProgress, facts: DefensivePlayFacts) {
  const strikeoutComboAtCall = facts.strikeout ? progress.moundStrikeoutCombo + 1 : 0
  return {
    moundStrikeouts: progress.moundStrikeouts + (facts.strikeout ? 1 : 0),
    strikeoutComboAtCall,
    moundStrikeoutCombo: facts.droppedThirdStrike ? 0 : strikeoutComboAtCall,
  }
}
