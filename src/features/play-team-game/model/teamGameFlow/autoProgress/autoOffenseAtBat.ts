import type { RandomPort } from '@/shared/api/random/randomPort'
import { playQuickPlateAppearance } from '@/entities/game/model/quickPlateAppearance'
import { runnersOfGame, applyAtBatOutcome } from '@/entities/game/model/gameState'
import { decisionsAfterPlay } from '@/features/play-game/model/gameDecisions'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import { outsAddedBetween } from '@/entities/game/model/gamePitcherLines'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import { scoredFromBasesOf } from '@/entities/game/model/runnerPitchers'
import { EMPTY_BASE_RUNNERS } from '@/entities/game/model/baseRunners'
import { isHit, describeOutcome } from '@/entities/at-bat/model/atBatOutcome'
import {
  entryQuickBatterOf,
  entryQuickPitcherOf,
  entryQuickTiredOf,
  quickPitcherDrainOf,
} from '@/features/play-team-game/model/teamGameFlow/autoPlay/quickEntries'
import { withQuickSteals } from '@/features/play-team-game/model/teamGameFlow/records/leagueStolenBases'
import { relayTickOf } from '@/features/play-team-game/model/teamGameFlow/autoProgress/relayTick'
import { opponentTeamMoraleOf } from '@/features/play-team-game/model/teamGameFlow/context/abilityContext'
import { appendLog } from '@/features/play-team-game/model/teamGameFlow/log/appendLog'
import { withOurAtBatRecords } from '@/features/play-team-game/model/teamGameFlow/records/atBatRecords'
import { withSeasonRecord } from '@/features/play-team-game/model/teamGameFlow/records/gameEndRecords'
import { withHitBases, withLeaguePlateAppearance, withPlateAppearance } from '@/features/play-team-game/model/teamGameFlow/records/plateAppearances'
import { offenseRecordOf } from '@/features/play-team-game/model/teamGameFlow/records/settlementRecords'
import { entryBatterIntimidatesAt } from '@/features/play-team-game/model/teamGameFlow/roster/batters'
import { opponentPitcherStaminaAbility, pitcherSkillFlagsAt } from '@/features/play-team-game/model/teamGameFlow/roster/pitchers'
import { moundsOf } from '@/features/play-team-game/model/teamGameFlow/settlement/decisions'
import {
  addRunsToCounters,
  chargeMoundLine,
  chargeRunsToResponsible,
  opponentAceStrikeoutsAfter,
} from '@/features/play-team-game/model/teamGameFlow/settlement/pitcherLines'
import { BATTING_ORDER_SIZE } from '@/features/play-team-game/model/teamGameFlow/types/constants'
import type { TeamAutoRelayTick, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 자동으로 넘기는 우리 타석 — 원본도 같은 간이 엔진을 쓴다 (0xc11f0). 0xc262c 머리의 교체 판정 0xc1ba4(우리가 공격 중이면
 * **상대 투수**를 본다)는 부르는 쪽이 먼저 다 지났다(`playAutoAtBat` · `playAutoTick`).
 */
export function playAutoOffenseAtBat(progress: TeamGameProgress, random: RandomPort, relay?: TeamAutoRelayTick[]): TeamGameProgress {
  // 이어 c26b6 0xa5bcc 가 대타 홈런 칸 ctx+0x160 을 지운다 — 간이 엔진 타석은 기록 5 를 못 낸다
  if (progress.pinchHitHomeRunHalf !== null) progress = { ...progress, pinchHitHomeRunHalf: null }
  const { options } = progress
  const before = progress.game
  const pitcherSlot = progress.opponentPitcherIndex
  const tiredAt = (percent: number) => entryQuickTiredOf(progress, options.opponentTeamId, pitcherSlot, percent)
  const pitcher = entryQuickPitcherOf(progress, options.opponentTeamId, pitcherSlot)
  const drain = quickPitcherDrainOf(
    pitcher,
    progress.opponentStamina,
    opponentPitcherStaminaAbility(progress),
    opponentTeamMoraleOf(options),
    progress.opponentUsedPitchers.length === 0,
    pitcherSkillFlagsAt(progress, options.opponentTeamId, pitcherSlot),
    entryBatterIntimidatesAt(progress, options.ourTeamId, before.battingOrderIndex),
    tiredAt,
  )
  const order = before.battingOrderIndex
  const appearance = playQuickPlateAppearance(
    {
      batter: entryQuickBatterOf(progress, options.ourTeamId, order),
      // 공마다 `beforePitch` 가 소모 뒤 체력%와 그 체력%로 부른 피로 능력을 실은 투수를 낸다
      pitcher,
      situation: {
        inning: before.inning,
        // 팀 경기 모드 1·2·8·9 는 0xab214 판정 묶음 '일반' — 공격(우리 팀)이 사람 팀이다(state[0x31 + 측] == 0, 자동진행이어도).
        // 상대 팀은 어느 모드든 CPU 다(`TeamGameOptions.mode` 주석 — 조작 칸)
        mode: '일반',
        isOffenseHuman: true,
        // 0xab966 — 수비(상대) 점수 > 공격(우리) 점수
        isLosing: before.opponentScore > before.ourScore,
        recentAtBatCodes: progress.ourEntryRecords[order]?.results ?? [],
      },
      bases: before.bases,
      outs: before.outs,
      // 루에 선 주자의 신원(우리 타순 칸) — 도루 판정은 앞선 주자의 주력
      runners: runnersOfGame(before, order),
      batterId: order,
      runnerRunOf: (runner) => entryQuickBatterOf(progress, options.ourTeamId, runner).run,
      beforePitch: drain.beforePitch,
    },
    random,
  )
  const play = appearance.play
  const outcome = play.outcome
  // 간이 엔진 타석 — 희생플라이가 없다 (E-2 확정). 볼넷 모든 주자 +1 · 도루 · 땅볼 진루는 `playQuickPlateAppearance` 가 먹였다
  const game = applyAtBatOutcome(before, outcome, appearance.advance, { runners: appearance.runners })
  const runsBattedIn = game.ourScore - before.ourScore
  const slot = before.battingOrderIndex
  const autoOffense = offenseRecordOf(outcome, runsBattedIn, progress.ourHitBases[slot] ?? [])

  // 간이 엔진 타석도 같은 0xa8024 → 0xa77f0 을 지난다 — 기록달성도 똑같이 쌓인다 (대타 홈런 5 는 c26b6 이 지워 없다)
  const recorded = withOurAtBatRecords(progress, slot, outcome, runsBattedIn, false)

  const result = appendLog(
    {
      ...recorded,
      game,
      // 간이 엔진 득점(0xc0fb4·0xc1054)도 같은 0xa5c34 를 부른다
      decisions: decisionsAfterPlay(progress.decisions, before, game, moundsOf(progress)),
      opponentAceStrikeouts: opponentAceStrikeoutsAfter(progress, outcome.kind === '삼진'),
      atBat: createAtBat(),
      atBatPrepared: false,
      // 투구마다 state[0xd]·state[0xe] 가 내려간다 (0xa5e14 의 a5e72·a5e7c, c26ca)
      pitcherJustChanged: false,
      cpuPinchHitUsed: false,
      // 공마다 이미 깎았다 (위 `beforePitch`)
      opponentStamina: drain.stamina(),
      // 실점은 들어온 주자의 책임 투수(주자+0x30)에게 — 간이 엔진 주자는 죽지 않아 루에서 빠진 앞선 주자가 들어온 주자다
      ...chargeRunsToResponsible(
        progress,
        chargeMoundLine(progress, false, {
          outs: outsAddedBetween(before, game),
          strikeouts: outcome.kind === '삼진' ? 1 : 0,
          pitches: play.pitches,
        }),
        game,
        false,
        lineupSlotOf(slot),
        scoredFromBasesOf(
          runnersOfGame(before),
          game.inning === before.inning && game.half === before.half ? appearance.runners : EMPTY_BASE_RUNNERS,
          runsBattedIn,
        ),
      ),
      opponentPitcherCounters: addRunsToCounters(
        progress.opponentPitcherCounters,
        runsBattedIn,
        play.pitches,
        game.inning !== before.inning || game.half !== before.half,
      ),
      ourHits: progress.ourHits + (isHit(outcome) ? 1 : 0),
      ourEntryRecords: withPlateAppearance(progress.ourEntryRecords, slot, outcome, true),
      // 0xc1a42~0xc1a98 — 도루 주자마다 +0x2c
      ...withQuickSteals(progress, true, appearance.stolenRunners),
      // 자동으로 넘긴 타석도 원본은 같은 0xa8024 를 지난다 — 평판 16칸도 똑같이 오른다
      gameRecord: withSeasonRecord(progress, '공격', autoOffense.codes),
      ourHitBases: withHitBases(progress.ourHitBases, slot, autoOffense.hitBases),
      leaguePlateAppearances: withLeaguePlateAppearance(
        progress.leaguePlateAppearances,
        options.ourTeamId,
        progress.ourEntry,
        slot,
        outcome,
        runsBattedIn,
      ),
    },
    `${before.inning}회${before.half} ${(slot % BATTING_ORDER_SIZE) + 1}번 — ${describeOutcome(outcome)}${
      runsBattedIn > 0 ? ` (${runsBattedIn}점)` : ''
    }`,
    false,
  )
  relay?.push(
    relayTickOf(result, before, {
      ours: true,
      orderIndex: slot,
      outcome,
      fouled: play.fouled === true,
      swingingStrikeOutLost: play.swingingStrikeOutLost === true,
      strikes: play.strikes,
      balls: play.balls,
      basesAtEnd: appearance.advance.bases,
      runnersAtEnd: appearance.runners,
    }),
  )
  return result
}
