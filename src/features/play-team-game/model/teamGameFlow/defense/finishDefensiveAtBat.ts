import { type AtBatOutcome, isHit, isFreePass, describeOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import { type AdvanceResult, advanceRunners } from '@/entities/game/model/baseState'
import type { BaseRunners } from '@/entities/game/model/baseRunners'
import type { PitchArrivalPlay } from '@/features/defense-play/model/pitchArrivalPlay'
import { applyOpponentAtBat } from '@/features/play-pitcher-game/model/pitcherGameState'
import { survivorsFromBaseOfFates, baserunnerAllowedOfFates, baserunnerAllowedOfPlay } from '@/features/defense-play/model/runnerFates'
import { decisionsAfterPlay } from '@/features/play-game/model/gameDecisions'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { withQuickSteals } from '@/features/play-team-game/model/teamGameFlow/autoPlay/quickEntries'
import { defensiveBurstPlayOf, resolveBurstFor } from '@/features/play-team-game/model/teamGameFlow/burst/burst'
import { defensiveAtBatChargesOf } from '@/features/play-team-game/model/teamGameFlow/defense/defensiveAtBatCharges'
import { appendLog } from '@/features/play-team-game/model/teamGameFlow/log/appendLog'
import { halfInningPitchesOf } from '@/features/play-team-game/model/teamGameFlow/records/atBatRecords'
import { withOurDefenseRecords } from '@/features/play-team-game/model/teamGameFlow/records/defenseRecords'
import { withSeasonRecord } from '@/features/play-team-game/model/teamGameFlow/records/gameEndRecords'
import { withLeaguePlateAppearance, withPlateAppearance } from '@/features/play-team-game/model/teamGameFlow/records/plateAppearances'
import { defenseRecordCodesOf, homeRunCountedOf } from '@/features/play-team-game/model/teamGameFlow/records/settlementRecords'
import { moundsOf } from '@/features/play-team-game/model/teamGameFlow/settlement/decisions'
import { addRunsToCounters } from '@/features/play-team-game/model/teamGameFlow/settlement/pitcherLines'
import type { StealArrivalPlay } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 상대 타석 하나를 경기 상태에 먹인다 — 예전 `applyDefensiveAtBat` 의 몸통이다.
 * `playback` 이 null 이면 재생할 것이 없다는 뜻이라 `lastDefensePlay` 는 그대로 둔다
 * (실시간으로 이미 다 보여 준 플레이가 여기로 온다 — 넣으면 같은 장면을 한 번 더 튼다).
 */
export function finishDefensiveAtBat(
  progress: TeamGameProgress,
  outcome: AtBatOutcome,
  mine: boolean,
  defensePlay: DefensePlayResult | null,
  playback: DefensePlayResult | null,
  /**
   * 자동으로 넘긴 간이 타석(`playQuickPlateAppearance`)이 먹인 주자와 도루 — 볼넷 모든 주자 +1(c1918) · 도루(c1982) · 땅볼 진루
   * (0xc15b8)까지. 있으면 결과 링 아웃이 5 이고, 도루 주자마다 리그 기록 +0x2c 를 쌓는다.
   */
  quick?: {
    readonly advance: AdvanceResult
    readonly runners: BaseRunners
    readonly stolenRunners: readonly number[]
  },
  /**
   * 이 삼진과 **한 정산**인 도루 판(종류 5) — 판정 B 0xae3e8 이 정산 0xa8024 를 종류 5 로 한 번만 부른다(ae5a8).
   * 판의 진루는 `applyTeamArrival` 가 먼저 먹였다. 있으면 `stealSettlementOf` 의 거르기를 따른다.
   */
  stealPlay?: StealArrivalPlay,
  /**
   * 이 삼진과 **한 정산**인 폭투·포일 판(종류 9, 삼진 그대로 — `strikeoutStands`). 판정 B 가 state[0xc] == 5 라 정산을 종류 9 로
   * 부른다(ae596 → ae5a6) — 종류 9 는 거르기가 없고, 주자 목록 · 사건 목록은 그 판의 것이다. 판의 진루는 `applyTeamArrival` 가
   * 먼저 먹였다.
   */
  wildPitchPlay?: PitchArrivalPlay,
): TeamGameProgress {
  const before = progress.game
  const applied = applyOpponentAtBat(
    before,
    progress.opponentOrderIndex,
    outcome,
    // 자동으로 넘긴 타석은 원본도 간이 엔진이다 — **간이 엔진에는 희생플라이가 없다** (E-2 확정)
    defensePlay?.advance ?? quick?.advance ?? advanceRunners(before.bases, outcome, before.outs, { quickEngine: true }),
    defensePlay !== null
      ? { survivorsFromBase: survivorsFromBaseOfFates(defensePlay.runnerFates) }
      : quick === undefined
        ? undefined
        : { runners: quick.runners },
  )
  const slot = progress.opponentOrderIndex
  const hit = isHit(outcome)
  // 투수 +0x2a 는 볼넷·사구를 함께 센다
  const walk = isFreePass(outcome)
  const stealPlayOuts = stealPlay?.result.advance.outsAdded
  // 정산 홈런 수 [sp+0x24] > 0 — 상대 타자의 장내 홈런도 타자 게이트 [sp+0x34](a84d6)를 본다 (`homeRunCountedOf`)
  const homeRunCounted = homeRunCountedOf(progress, outcome, defensePlay, false)
  // 이 정산의 주자 목록을 낸 판 — 종류 5 · 종류 9 판이 함께 선 삼진이면 그 판(a8c5c 는 판의 목록을 본다)
  const runnerListPlay = stealPlay?.result ?? wildPitchPlay?.result
  // 낫아웃(state[0x1a]) — 판 운명을 진루로 먹이는 삼진은 0x3e09e 갈래뿐이다. 삼진 콜이 넣은 사건 5 가 [sp+0x30] 에 하나 더 든다
  const droppedThirdStrike = outcome.kind === '삼진' && defensePlay !== null

  const next: TeamGameProgress = {
    ...progress,
    game: applied.game,
    decisions: decisionsAfterPlay(progress.decisions, before, applied.game, moundsOf(progress)),
    // 정산 0xa8024 — 우리 마운드 투수 레코드에 아웃·실점·탈삼진 (a8cb0 +0x20 · a8d14 +0x26 은 종류를 안 거른다)
    // 실점은 들어온 주자의 책임 투수(주자+0x30)에게 (a8ee4) — 승계 주자면 앞 투수 몫이다
    ...defensiveAtBatChargesOf(progress, before, applied, outcome, defensePlay, quick, droppedThirdStrike, walk),
    opponentOrderIndex: applied.opponentOrderIndex,
    lastDefensePlay: playback ?? progress.lastDefensePlay,
    defenseScene: defensePlay?.scene ?? progress.defenseScene,
    atBat: createAtBat(),
    atBatPrepared: false,
    // 득점 처리 0xa5c34 가 1점마다 수비 팀 A·B 를 올린다 (P7 E1)
    ourPitcherCounters: addRunsToCounters(
      progress.ourPitcherCounters,
      applied.runsScored,
      0,
      applied.game.inning !== before.inning || applied.game.half !== before.half,
    ),
    pitching: {
      outsRecorded: progress.pitching.outsRecorded + applied.outsAdded,
      hitsAllowed: progress.pitching.hitsAllowed + (hit ? 1 : 0),
      walksAllowed: progress.pitching.walksAllowed + (walk ? 1 : 0),
      runsAllowed: progress.pitching.runsAllowed + applied.runsScored,
      // 종류 5 · 9 정산의 주자 목록은 그 판의 것이다 — 도루 판엔 타자가 없고, 삼진 그대로인 폭투 판도 state[0x1a] 가 0 이라
      // 0x46418 이 타자주자를 안 끼운다 (a8c5c)
      allowedBaserunner:
        progress.pitching.allowedBaserunner ||
        (runnerListPlay !== undefined
          ? baserunnerAllowedOfFates(runnerListPlay.runnerFates)
          : baserunnerAllowedOfPlay(before.bases, outcome, mine, defensePlay, quick?.advance)),
    },
    // 시즌 평판 16칸 — 우리 수비라 **공격측(상대)이 CPU** 인 코드(≤ 5)만 선다
    gameRecord: withSeasonRecord(
      progress,
      '수비',
      defenseRecordCodesOf(
        outcome,
        applied.outsAdded + (stealPlayOuts ?? 0) + (wildPitchPlay?.result.advance.outsAdded ?? 0) + (droppedThirdStrike ? 1 : 0),
        stealPlay !== undefined,
        droppedThirdStrike,
      ),
    ),
    // 종류 5 정산은 타석 칸(+0x14 · a8ac8)도 결과 링(a8a04)도 안 올린다 — 견제 판과 같은 게이트
    opponentEntryRecords: withPlateAppearance(
      progress.opponentEntryRecords,
      slot,
      stealPlay === undefined ? outcome : null,
      quick !== undefined,
      stealPlay === undefined && homeRunCounted,
    ),
    // 리그 타수 +0x20 (a8866~a8894)도 종류 4·5 를 건너뛴다(a8852) — 삼진이 리그 줄에 쌓는 칸은 타수뿐이다
    leaguePlateAppearances:
      stealPlay !== undefined
        ? progress.leaguePlateAppearances
        : withLeaguePlateAppearance(
            progress.leaguePlateAppearances,
            progress.options.opponentTeamId,
            progress.opponentEntry,
            slot,
            outcome,
            applied.runsScored,
          ),
    ...withQuickSteals(progress, false, quick?.stolenRunners ?? []),
  }

  // 기록달성 (0xa7c4c · 0xa7998 · 0xa7d0c · 0xa8024 → 0xa77f0) — 사람 수비라 수비 계열이 게이트를 지난다
  const recorded = withOurDefenseRecords(next, {
    outcome,
    outsBefore: before.outs,
    outsAdded: applied.outsAdded,
    atBatPitches: progress.recordTally.atBatPitches,
    balls: progress.atBat.balls,
    halfInningPitches: halfInningPitchesOf(progress.recordTally, before),
    // state[0x8b] — 판의 결과 판이 세운 표시. 삼진과 한 정산인 도루 · 폭투 판이면 그 판의 것 (a80f8)
    laserOutFlag: (defensePlay ?? runnerListPlay)?.laserOutFlag ?? false,
    ...(stealPlayOuts === undefined ? {} : { stealPlayOuts }),
    ...(wildPitchPlay === undefined ? {} : { wildPitchPlayOuts: wildPitchPlay.result.advance.outsAdded }),
    ...(droppedThirdStrike ? { droppedThirdStrike } : {}),
  })

  // 돌발 판정 0x8f414(돌발, 0xa7749 = ctx+0x188) — 삼진 + 도루 판은 판정 A(0xae24c)가 state[0xb] 3·4 라 정산 없이 0x17 로 보내
  // 0x12 끝(4e7ca)의 판정이 비트 0 으로 돌고, 0x17 끝(52a8e)의 판정도 종류 5 정산이 비트를 안 켜(0xa599c a59a8) 0 으로 돈다.
  // ctx+0x188 을 지우는 곳은 타석 초기화 0xa5bcc(a5be0) 하나뿐이라 그 사이 다른 비트가 없다 → 8f41e 에서 그냥 돌아간다(판정 없음,
  // 돌발은 남는다). 웹도 판정을 건너뛰어 같은 결과다 — 남은 돌발은 다음 사람 타석 끝에 그 타석의 비트로 판정된다
  // (0x21 진입 · 0x18 뒤집힘이 먼저면 0x8f628 이 내린다)
  const resolved =
    mine && stealPlay === undefined
      ? resolveBurstFor(recorded, defensiveBurstPlayOf(before, applied, outcome, defensePlay, droppedThirdStrike, homeRunCounted))
      : recorded

  return appendLog(
    resolved,
    `${before.inning}회${before.half} 상대 ${slot + 1}번 — ${describeOutcome(outcome)}${
      applied.runsScored > 0 ? ` (${applied.runsScored}실점)` : ''
    }`,
    mine,
  )
}
