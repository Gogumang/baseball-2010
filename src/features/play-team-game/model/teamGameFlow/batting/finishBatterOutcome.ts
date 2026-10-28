import { type AtBatOutcome, isFreePass, isHit, describeOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { applyAtBatOutcome, runnersOfGame } from '@/entities/game/model/gameState'
import { survivorsFromBaseOfFates, batterRunnerSafeOfFates } from '@/features/defense-play/model/runnerFates'
import { advanceRunners } from '@/entities/game/model/baseState'
import { decisionsAfterPlay } from '@/features/play-game/model/gameDecisions'
import { outsAddedBetween } from '@/entities/game/model/gamePitcherLines'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import { EMPTY_BASE_RUNNERS } from '@/entities/game/model/baseRunners'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { resolveBurstFor } from '@/features/play-team-game/model/teamGameFlow/burst/burst'
import { advance } from '@/features/play-team-game/model/teamGameFlow/inningChange/advance'
import { appendLog } from '@/features/play-team-game/model/teamGameFlow/log/appendLog'
import { withOurAtBatRecords } from '@/features/play-team-game/model/teamGameFlow/records/atBatRecords'
import { withSeasonRecord } from '@/features/play-team-game/model/teamGameFlow/records/gameEndRecords'
import { withHitBases, withLeaguePlateAppearance, withPlateAppearance } from '@/features/play-team-game/model/teamGameFlow/records/plateAppearances'
import { homeRunCountedOf, offenseRecordOf } from '@/features/play-team-game/model/teamGameFlow/records/settlementRecords'
import { moundsOf } from '@/features/play-team-game/model/teamGameFlow/settlement/decisions'
import {
  addRunsToCounters,
  chargeMoundLine,
  chargeRunsToResponsible,
  opponentAceStrikeoutsAfter,
  scoredFromBasesOfAtBat,
} from '@/features/play-team-game/model/teamGameFlow/settlement/pitcherLines'
import { isPinchHitAtBat } from '@/features/play-team-game/model/teamGameFlow/substitution/pinchHit'
import { BATTING_ORDER_SIZE } from '@/features/play-team-game/model/teamGameFlow/types/constants'
import type { StealArrivalPlay } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 사람 타석 하나를 경기 상태에 먹이고 다음 사람 차례까지 민다 — 예전 `applyBatterOutcome` 의 몸통이다.
 *
 * `defensePlay` 가 있으면 그 결과로 진루·아웃·득점을 갈아 끼운다. `playback` 은 화면에 재생시킬 것 —
 * **실시간으로 이미 다 보여 준 플레이는 null** 이고, 홈런은 부르는 쪽이 비행 틱을 만들어 넘긴다.
 */
export function finishBatterOutcome(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  random: RandomPort,
  defensePlay: DefensePlayResult | null,
  playback: DefensePlayResult | null,
  /**
   * 이 삼진과 **한 정산**인 도루 판(종류 5) — 정산 0xa8024 를 종류 5 로 한 번만 부른다(ae5a8). 판의 진루는 `applyTeamArrival` 가
   * 먼저 먹였다. 있으면 종류 4·5 가 건너뛰는 칸(범타·삼진 갈래 a8a04 의 결과 링 · ctx+0x162 지우기 · 시즌 코드 6, a8ac8 타석 칸 +0x14,
   * a8852 리그 타수 +0x20, 돌발 비트 0xa599c)을 안 센다. 상대 투수 줄의 아웃 · 탈삼진(a8cb0 · a8d14)은 그대로 센다.
   */
  stealPlay?: StealArrivalPlay,
): TeamGameProgress {
  const before = progress.game

  const game = applyAtBatOutcome(
    before,
    outcome,
    defensePlay?.advance,
    defensePlay === null ? undefined : { survivorsFromBase: survivorsFromBaseOfFates(defensePlay.runnerFates) },
  )
  const runsBattedIn = game.ourScore - before.ourScore
  // 아웃 수는 반 이닝이 넘어가면 0 으로 되돌아가므로 진행 결과에서 직접 읽는다 (`gameFlow` 와 같은 길)
  const outsAdded = defensePlay?.advance.outsAdded ?? advanceRunners(before.bases, outcome, before.outs).outsAdded
  const slot = before.battingOrderIndex
  const isWalkOff = game.isFinished && runsBattedIn > 0 && game.ourScore > game.opponentScore
  const runnerPlay = stealPlay !== undefined
  // 낫아웃(state[0x1a]) — 0x3e09e 갈래의 삼진 콜 0xa7c4c 가 사건 5 를 넣고 판(타자주자 포함)을 돈다. 정산 [sp+0x30] 에 그 사건이
  // 판의 아웃 사건 앞에 하나 더 든다 — 상대 투수 +0x20(a8cb0)은 보정 없이 더한다
  const droppedThirdStrike = outcome.kind === '삼진' && defensePlay !== null && !runnerPlay
  // 정산 홈런 수 [sp+0x24] > 0 — 장내 홈런은 타자 게이트 [sp+0x34](a84d6)가 참일 때만 (`homeRunCountedOf`)
  const homeRunCounted = homeRunCountedOf(progress, outcome, defensePlay, true)
  // 시즌 평판 16칸 — 우리 공격이라 **수비측(상대)이 CPU** 인 코드(≥ 6)만 선다. 종류 5 정산은 삼진 코드 6(a8a46)을 안 지난다
  const offense = runnerPlay
    ? { codes: [], hitBases: progress.ourHitBases[slot] ?? [] }
    : offenseRecordOf(outcome, runsBattedIn, progress.ourHitBases[slot] ?? [], homeRunCounted)
  // 기록달성 (0xa8024 → 0xa77f0) — 사람 공격이라 공격 계열이 게이트를 지난다. 5 대타 홈런은 ctx+0x160 을 본다.
  // 종류 5 정산은 타석 결과 목록(0xa908d)도 백투백 카운터 지우기(a8ab2)도 안 지난다
  const recorded = runnerPlay ? progress : withOurAtBatRecords(progress, slot, outcome, runsBattedIn, isPinchHitAtBat(progress), homeRunCounted)

  const next: TeamGameProgress = {
    ...recorded,
    game,
    // 득점 처리 0xa5c34 — 한 점씩 승·패·세 칸을 고친다
    decisions: decisionsAfterPlay(progress.decisions, before, game, moundsOf(progress)),
    opponentAceStrikeouts: opponentAceStrikeoutsAfter(progress, outcome.kind === '삼진'),
    // 정산 0xa8024 — 상대 마운드 투수 레코드에 아웃(결과 코드 5·0xd)·실점·탈삼진
    // 실점은 들어온 주자의 책임 투수(주자+0x30)에게 (a8ee4)
    ...chargeRunsToResponsible(
      progress,
      chargeMoundLine(progress, false, {
        outs: outsAddedBetween(before, game) + (droppedThirdStrike ? 1 : 0),
        strikeouts: outcome.kind === '삼진' ? 1 : 0,
        // a8b04~a8bee — 볼넷(사람 판정 3e1ae 가 볼을 넷째로 센다) · 사구면 지금 마운드 투수 +0x2a
        walks: isFreePass(outcome) ? 1 : 0,
      }),
      game,
      false,
      lineupSlotOf(before.battingOrderIndex),
      scoredFromBasesOfAtBat(
        before,
        runnersOfGame(before),
        game.inning === before.inning && game.half === before.half ? runnersOfGame(game) : EMPTY_BASE_RUNNERS,
        outcome,
        defensePlay,
        false,
        outsAdded,
        runsBattedIn,
      ),
    ),
    gameRecord: withSeasonRecord(progress, '공격', offense.codes),
    ourHitBases: withHitBases(progress.ourHitBases, slot, offense.hitBases),
    lastDefensePlay: playback,
    defenseScene: defensePlay?.scene ?? progress.defenseScene,
    atBat: createAtBat(),
    atBatPrepared: false,
    // 다음 타석 시작 0x48d50 → 0xa5bcc 가 ctx+0x160 을 지운다
    pinchHitHomeRunHalf: null,
    // 우리 타석의 득점은 **상대 투수**의 A·B 로 들어간다 (0xa5c34 는 수비 팀 칸을 올린다)
    opponentPitcherCounters: addRunsToCounters(
      progress.opponentPitcherCounters,
      runsBattedIn,
      0,
      game.inning !== before.inning || game.half !== before.half,
    ),
    ourHits: progress.ourHits + (isHit(outcome) ? 1 : 0),
    ourEntryRecords: withPlateAppearance(progress.ourEntryRecords, slot, runnerPlay ? null : outcome, false, homeRunCounted),
    leaguePlateAppearances: runnerPlay
      ? progress.leaguePlateAppearances
      : withLeaguePlateAppearance(progress.leaguePlateAppearances, progress.options.ourTeamId, progress.ourEntry, slot, outcome, runsBattedIn),
  }

  // 돌발 결과 비트 0xa599c 는 종류 4·5 정산이면 안 켠다 — 0x12 끝 · 0x17 끝의 0x8f414 가 비트 0 으로 돌아 판정이 없다
  // (`finishDefensiveAtBat` 의 같은 자리 주석)
  const resolved = runnerPlay
    ? next
    : resolveBurstFor(next, {
        outcome,
        runsBattedIn,
        outsBefore: before.outs,
        // [sp+0x30] — 낫아웃은 삼진 사건이 하나 더 들고 B9 를 안 켠다 (a8fc6)
        outsAdded: outsAdded + (droppedThirdStrike ? 1 : 0),
        strikeoutWhileRunning: droppedThirdStrike,
        humanTeamWalkOff: isWalkOff,
        batterRunnerSafe: defensePlay === null ? undefined : batterRunnerSafeOfFates(defensePlay.runnerFates),
        // B6 — 번트 타구(state[0x13]) && (희생 [sp+8] || 득점) (a88e0 · a88f8)
        isBunt: defensePlay?.buntBall === true,
        runnersAdvanced: defensePlay?.sacrifice === true,
        // B7 — 루프 a88fc: !0xb68dc(파울 — 정산에 오는 판은 번트 파울 아웃뿐) && 2·3루 첫 산 주자가 타자 아님 && 번트
        foulBall: defensePlay?.buntFoulOut === true,
        runnerInScoringPositionAfter: defensePlay?.scoringBaseRunnerAfter === true,
        homeRunCounted,
      })

  return advance(
    appendLog(
      resolved,
      `${before.inning}회${before.half} ${(slot % BATTING_ORDER_SIZE) + 1}번 — ${describeOutcome(outcome)}${
        runsBattedIn > 0 ? ` (${runsBattedIn}타점)` : ''
      }`,
      true,
    ),
    random,
  )
}
