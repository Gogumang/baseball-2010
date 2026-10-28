import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { PendingSettlementEvents } from '@/features/defense-play/model/settlementEvents'
import { baserunnerAllowedOfFates, batterRunnerSafeOfFates } from '@/features/defense-play/model/runnerFates'
import { laserThrowOutRecordOf, multiOutPlayRecordIdsOf, threePitchInningRecordIdsOf } from '@/entities/game/model/gameRecords'
import { recordPlateAppearance, EMPTY_BATTER_GAME_RECORD } from '@/entities/batting/model/pinchHitAi'
import { RUNNER_PLAY_OUTCOME_PLACEHOLDER } from '@/features/play-team-game/model/teamGameFlow/baseRunning/runnerOnlyAdvance'
import { resolveBurstFor } from '@/features/play-team-game/model/teamGameFlow/burst/burst'
import { halfInningPitchesOf, withGameRecords } from '@/features/play-team-game/model/teamGameFlow/records/atBatRecords'
import { withSeasonRecord } from '@/features/play-team-game/model/teamGameFlow/records/gameEndRecords'
import { withLeaguePlateAppearance } from '@/features/play-team-game/model/teamGameFlow/records/plateAppearances'
import { defenseRecordCodesOf } from '@/features/play-team-game/model/teamGameFlow/records/settlementRecords'
import { chargeMoundLine } from '@/features/play-team-game/model/teamGameFlow/settlement/pitcherLines'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * **타석 결과 없는 주자 판(견제 종류 4 · 삼진 없는 도루 종류 5)의 정산 0xa8024** — 종류로 거르지 않는 칸만 남는다
 * (직접 떴다, `withOurDefenseRecords` 머리말). 판의 진루 · 점수판 · 그 판 아웃 · 실점의 투수 줄은 부르는 쪽이
 * `withRunnerOnlyAdvance` 로 먼저 먹였다.
 * ```
 * a80f8  [sp+0x30] > 0 && state[0x8b](필살송구 표시) → k 36            ; state[0x8b] 는 0xf 진입 0xb67d0(b680c)이 지워 이 판 것이다
 * a8c5c  state[0x88] — 이 판의 주자 목록 마지막 원소가 안 끝났으면 (수비 팀이 사람일 때)
 * a8cb0  수비 팀 지금 투수 레코드 +0x20 += [sp+0x30]                     ; 0xa56dc 본인 필터
 * a8dd0  수비 팀이 사람이면 state[0x8a] += [sp+0x28]
 * a8e58  [sp+0x30] == 2 → k 26 · 0xa755c(5) / == 3 → k 27 · 0xa755c(0)  ; state[0x1a] 는 0xf 진입이 지워 거짓
 * a8f8c  수비 팀 지금 투수 R[3] += [sp+0x30]
 * ```
 * [sp+0x30] · [sp+0x28] 은 사건 목록을 훑은 값이다 — 도루 판은 그 공의 0x11 이 목록을 비운 뒤라 판의 것뿐이고, **견제 판은
 * 같은 투구 틈에 앞서 돈 판의 몫이 함께 든다**(`settlementEvents`, 원본 그대로 — 앞 판이 이미 정산됐어도 다시 센다).
 * 그래서 투수 줄의 아웃 · state[0x8a] 에는 앞 몫(`events` − 판)을 더 얹는다.
 *
 * 사람 공격이면 병살 · 삼중살(26·27) · 36 은 게이트(사람 수비)에, 시즌 코드 5·0 은 0xa755c(코드 ≤ 5 면 공격측이 CPU)에 막히고,
 * R[3] · state[0x88] · state[0x8a] 는 수비 팀 쪽 칸이라 상대(CPU) 투수 몫이다 — 남는 것은 상대 투수 줄의 아웃(+0x20)뿐이다.
 * 아웃 콜 0xa7d0c(견제사 · 도루 저지 콜 20 · 62 → 결과 13, Q2 2e)의 25(삼구 삼자범퇴)는 정산이 아니라 콜마다라 판의 아웃만 본다.
 */
export function withRunnerPlaySettlement(
  next: TeamGameProgress,
  before: TeamGameProgress,
  result: DefensePlayResult,
  humanOffense: boolean,
  /** 이 정산이 훑는 사건 — 판의 것에 같은 투구 틈 앞 판의 몫을 더한 값 */
  events: PendingSettlementEvents,
): TeamGameProgress {
  const playOuts = result.advance.outsAdded
  const earlierOuts = events.outs - playOuts
  const earlierRuns = events.runs - result.advance.runsScored
  const lines = earlierOuts > 0 ? chargeMoundLine(next, !humanOffense, { outs: earlierOuts }) : next.pitcherLines
  if (humanOffense) return lines === next.pitcherLines ? next : { ...next, pitcherLines: lines }
  const outsInPlay = events.outs
  const allowed = next.pitching.allowedBaserunner || baserunnerAllowedOfFates(result.runnerFates)
  const pitching =
    allowed === next.pitching.allowedBaserunner && earlierRuns === 0
      ? next.pitching
      : { ...next.pitching, allowedBaserunner: allowed, runsAllowed: next.pitching.runsAllowed + earlierRuns }
  const tally = next.recordTally
  const settled: TeamGameProgress = {
    ...next,
    pitcherLines: lines,
    pitching,
    recordTally: outsInPlay === 0 ? tally : { ...tally, moundOuts: tally.moundOuts + outsInPlay },
    gameRecord: withSeasonRecord(next, '수비', defenseRecordCodesOf(null, outsInPlay, true)),
  }
  return withGameRecords(
    settled,
    [
      ...laserThrowOutRecordOf({ laserThrowFlag: result.laserOutFlag, outsInPlay }).recordIds,
      ...multiOutPlayRecordIdsOf({ outsInPlay, strikeoutWhileRunning: false }),
      ...(playOuts > 0 ? threePitchInningRecordIdsOf(halfInningPitchesOf(before.recordTally, before.game), before.game.outs + playOuts) : []),
    ],
    false,
  )
}

/**
 * **삼진 없이 3아웃 · 경기 끝으로 정산되는 폭투·포일 판(종류 9)의 타석 쪽 칸** — 정산 0xa8024 는 종류 9 를 안 거른다(직접 떴다):
 * ```
 * a882e/a8852  아웃 > 0 이고 득점이 없으면 지금 타자 타수 +0x20([sp+0x34]) · 타순 칸 +0x11        ; 득점 · 아웃이 함께면 건너뜀
 * a89f4        아웃 > 0 → 결과 링 ← 5 · ctx+0x162 = 0
 * a8ac8        타순 칸 타석 +0x14 (아웃이 없는 끝내기 판도)
 * a8fb2        삼진 없음 → 수비 팀 지금 투수 R[1](연속 삼진) = 0
 * 0xa599c      결과비트 → 0x17 끝(52a8e)의 0x8f414 가 그 비트로 돌발을 판정한다
 * ```
 * 거르지 않는 칸(36 · 26/27 · R[3] · state[0x88])은 부르는 쪽이 `withRunnerPlaySettlement` 로 먼저 셌다.
 */
export function withTeamWildPitchSettlement(
  next: TeamGameProgress,
  before: TeamGameProgress,
  result: DefensePlayResult,
  humanOffense: boolean,
): TeamGameProgress {
  const outs = result.advance.outsAdded
  const runs = result.advance.runsScored
  const slot = humanOffense ? before.game.battingOrderIndex : before.opponentOrderIndex
  const recordsBefore = humanOffense ? next.ourEntryRecords : next.opponentEntryRecords
  const records = [...recordsBefore]
  records[slot] = recordPlateAppearance(records[slot] ?? EMPTY_BATTER_GAME_RECORD, {
    isHit: false,
    isHomeRun: false,
    ...(outs > 0 ? { resultCode: WILD_PITCH_OUT_RESULT_CODE } : {}),
  })
  const tally = next.recordTally
  const settled: TeamGameProgress = {
    ...next,
    ...(humanOffense ? { ourEntryRecords: records } : { opponentEntryRecords: records }),
    leaguePlateAppearances:
      outs > 0 && runs === 0
        ? withLeaguePlateAppearance(
            next.leaguePlateAppearances,
            humanOffense ? next.options.ourTeamId : next.options.opponentTeamId,
            humanOffense ? next.ourEntry : next.opponentEntry,
            slot,
            RUNNER_PLAY_OUTCOME_PLACEHOLDER,
            0,
          )
        : next.leaguePlateAppearances,
    recordTally: {
      ...tally,
      homeRunStreak: outs > 0 ? 0 : tally.homeRunStreak,
      // R[1] 은 수비 팀 지금 투수 칸 — 우리가 지키는 쪽만 든다
      moundStrikeoutCombo: humanOffense ? tally.moundStrikeoutCombo : 0,
    },
  }
  return resolveBurstFor(settled, {
    // 안타 · 볼넷 갈래가 아니다 — B4(타점)는 a8946 갈래(희생플라이 · 볼넷 · 사구) 안이라 안 선다
    outcome: RUNNER_PLAY_OUTCOME_PLACEHOLDER,
    runsBattedIn: 0,
    outsBefore: before.game.outs,
    outsAdded: outs,
    humanTeamWalkOff: next.game.isFinished && next.game.ourScore > next.game.opponentScore,
    // B5 의 r5 — 목록 0번(가장 뒤 주자)이 들어왔는가
    batterRunnerSafe: batterRunnerSafeOfFates(result.runnerFates),
  })
}

/** 종류 9 판 정산의 결과 링 코드 5(그 밖의 아웃, a8a9e) — 판에 공 잡은 뜬공이 없다 */
const WILD_PITCH_OUT_RESULT_CODE = 5
