import { applyAtBatOutcome, runnersOfGame } from '@/entities/game/model/gameState'
import { EMPTY_BASE_RUNNERS } from '@/entities/game/model/baseRunners'
import { chargedRunsByPitcher, scoredFromBasesOf, settleRunnerPitchers } from '@/entities/game/model/runnerPitchers'
import { describeOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { playQuickPlateAppearance } from '@/entities/game/model/quickPlateAppearance'
import { facingPitcherOf } from '@/entities/game/model/simulateHalfInning'
import { lineupSlotOf, recordLineupPlay, rosterSlotAt, withLineupRecordSlot } from '@/entities/game/model/quickLineup'
import { EMPTY_BATTER_GAME_LOG, recordBatterAtBat } from '@/entities/game/model/batterGameLog'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { clearInningRuns } from '@/features/play-pitcher-game/model/pitcherGameState'
import { outsAddedBetween } from '@/entities/game/model/gamePitcherLines'
import { opponentQuickDefenseOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/auto/quickDefense'
import {
  perPitchDrainOf,
  relayTickOf,
  runQuickSubstitutions,
  withMoundsPitched,
} from '@/features/play-pitcher-game/model/pitcherGameFlow/auto/quickPitching'
import { quickBatterOfTeam } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/opponentBatters'
import { chargeCpuPitcherLine } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/pitcherLines'
import { withLeaguePlateAppearance, withLeagueSteals } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/leagueRecords'
import { applyRunScoredForOffense } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/runScored'
import { BATTING_ORDER_SIZE, MAXIMUM_PITCHER_COUNTER } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import { appendLog } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/gameLog'
import type { PitcherAutoRelayTick, PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'
import { recordsAllowed } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/recordGates'

/** 동료 타석 — 투수편 주인공은 타석에 서지 않으므로 아홉 칸 모두 간이 엔진이 돈다 */
export function playTeammateAtBat(
  progress: PitcherGameProgress,
  random: RandomPort,
  /** 자동진행 중계 틱을 여기 쌓는다 (`autoRelay`) */
  relay?: PitcherAutoRelayTick[],
): PitcherGameProgress {
  const { options } = progress
  // 0xc262c 는 타석마다 먼저 0xc1ba4 — 우리(공격) CPU 대타 → 상대(수비) 투수 교체
  progress = runQuickSubstitutions(progress, true, random, (after, before) => relay?.push(relayTickOf(after, before, null)))
  // 동료 타석은 자동진행(0x21) 안의 간이 타석 — 상태 0xf 를 안 지나 돌발 굴림(0x8f158)·판정(0x8f414)이 없다
  const before = progress.game
  const mound = progress.opponentMound
  const defense = opponentQuickDefenseOf(progress)
  const order = before.battingOrderIndex
  // 대타가 들어오면 그 타순 칸에 선 선수가 바뀐다 — 명단(`team+0xe`)에서 고른다
  const batter = withLineupRecordSlot(quickBatterOfTeam(options, true, rosterSlotAt(progress.ourLineup, order)), progress.ourLineup, order)
  const pitched = perPitchDrainOf(defense, mound, batter)
  const appearance = playQuickPlateAppearance(
    {
      batter,
      // 간이 엔진이 보는 투수 체력은 체력%(0xaebb0)다 — 마운드의 살아 있는 값과 그 체력%로 부른 피로 능력(0xb58e6)
      pitcher: facingPitcherOf(defense, mound.pitcherSlot, staminaPercentOf(mound.stamina)),
      situation: {
        inning: before.inning,
        // 전역 모드 3 · 공격(우리 팀)이 사람 팀(0x3a20a)
        mode: '나만의리그',
        isOffenseHuman: true,
        // 0xab966 — 수비(상대) 점수 > 공격(우리) 점수
        isLosing: before.opponentScore > before.ourScore,
        recentAtBatCodes: progress.ourLineup.records[lineupSlotOf(order)]?.results ?? [],
      },
      bases: before.bases,
      outs: before.outs,
      // 루에 선 주자의 신원(우리 타순 칸) — 도루 판정은 앞선 주자의 주력
      runners: runnersOfGame(before, order),
      batterId: lineupSlotOf(order),
      runnerRunOf: (runner) => quickBatterOfTeam(options, true, rosterSlotAt(progress.ourLineup, runner)).run,
      beforePitch: pitched.beforePitch,
    },
    random,
  )
  const play = appearance.play
  const outcome = play.outcome
  // 동료 타석은 원본도 간이 엔진(0xc262c)이다 — 희생플라이가 없다 (E-2 확정). 볼넷 모든 주자 +1 · 도루 · 땅볼 진루는
  // `playQuickPlateAppearance` 가 먹였다. 도루 +0x2c 는 리그 기록 재료로 (`leagueStolenBases`)
  const game = applyAtBatOutcome(before, outcome, appearance.advance, { runners: appearance.runners })
  const runs = game.ourScore - before.ourScore
  let decision = progress.decision
  for (let run = 1; run <= runs; run += 1) {
    decision = applyRunScoredForOffense(progress, decision, run)
  }
  const slot = before.battingOrderIndex
  const halfChanged = game.half !== before.half || game.inning !== before.inning
  // 실점은 들어온 주자의 책임 투수(주자+0x30)에게 — 간이 엔진 주자는 죽지 않아 루에서 빠진 앞선 주자가 들어온 주자다
  const runnersAtPitch = runnersOfGame(before, order)
  const runnersAfter = halfChanged ? EMPTY_BASE_RUNNERS : appearance.runners
  const runnerSettlement = settleRunnerPitchers({
    tags: progress.runnerPitchers,
    before: runnersAtPitch,
    after: runnersAfter,
    batter: lineupSlotOf(order),
    pitcher: mound.pitcherSlot,
    scoredFromBases: scoredFromBasesOf(runnersAtPitch, runnersAfter, runs),
  })
  // 모드 3 은 내 팀 전체가 사람 팀이라 **공격 게이트도 열린다** (0x3a20a) —
  // 간이 엔진이 돌린 동료 타석도 같은 0xa8024 를 지나 타격 기록(0~15·34·35)이 된다 (R8 1절·8절).
  const recorded = recordBatterAtBat(progress.teammateLogs[slot] ?? EMPTY_BATTER_GAME_LOG, outcome, runs)
  const result = appendLog(
    {
      ...progress,
      game,
      decision,
      endedInningIndex: game.inning - 1,
      teammateLogs: { ...progress.teammateLogs, [slot]: recorded.log },
      // 정산 0xa8024 — 타순 칸 기록(타석·안타·홈런)이 다음 CPU 대타 판정의 재료다
      ourLineup: recordLineupPlay(progress.ourLineup, slot, outcome, { quickEngine: true }),
      // 같은 정산이 상대 마운드 투수 레코드에 아웃·탈삼진을, 실점은 들어온 주자의 책임 투수에게 쌓는다 (a8cb0 · a8d00 · a8ee4)
      pitcherLines: chargedRunsByPitcher(runnerSettlement.charged).reduce(
        (lines, [pitcherSlot, runsAllowed]) => chargeCpuPitcherLine(lines, options.opponentTeamId, pitcherSlot, { runsAllowed }),
        chargeCpuPitcherLine(progress.pitcherLines, options.opponentTeamId, mound.pitcherSlot, {
          outs: outsAddedBetween(before, game),
          strikeouts: outcome.kind === '삼진' ? 1 : 0,
        }),
      ),
      runnerPitchers: runnerSettlement.tags,
      recordIds: recordsAllowed(progress) ? [...progress.recordIds, ...recorded.recordIds] : progress.recordIds,
      perfectInningFlag: halfChanged ? true : progress.perfectInningFlag,
      inningRuns: halfChanged ? clearInningRuns(progress.inningRuns, game.inning) : progress.inningRuns,
      // 우리 공격이 끝나면 다음 수비 반 이닝의 투구 수를 0 부터 센다
      halfInningPitches: halfChanged ? 0 : progress.halfInningPitches,
      // 간이 엔진도 공마다 0xa5e14 를 부른다 (c26ca) — state[0xe]·state[0xd] 가 내려간다
      pinchHitUsed: false,
      ...withMoundsPitched(progress),
      opponentMound: {
        ...mound,
        // 공마다 이미 깎았다 (위 `beforePitch`, 0xc262c 의 c26c8)
        stamina: pitched.stamina(),
        runsAllowed: Math.min(MAXIMUM_PITCHER_COUNTER, mound.runsAllowed + runs),
        pitches: mound.pitches + play.pitches,
        justChanged: false,
      },
      // 반 이닝 교대 0xa5b00 이 A 를 0 으로
      opponentInningRunsAllowed: halfChanged ? 0 : Math.min(MAXIMUM_PITCHER_COUNTER, progress.opponentInningRunsAllowed + runs),
      // 간이 타석도 같은 0xa8024 — 0xa56dc(ctx, 지금 타자, 0) 이면 동료 타자 레코드 +0x20~+0x2a (마타자 칸은 거짓)
      ...withLeaguePlateAppearance(progress, true, slot, outcome, runs),
    },
    `${before.inning}회${before.half} ${(slot % BATTING_ORDER_SIZE) + 1}번 — ${describeOutcome(outcome)}${runs > 0 ? ` (${runs}점)` : ''}`,
    false,
  )
  // 0xc1a42 — 간이 타석 도루 주자마다 0xa56dc(ctx, 주자, 0) 참이면 +0x2c (우리 팀 주자)
  const withSteals = withLeagueSteals(result, true, appearance.stolenRunners)
  relay?.push(
    relayTickOf(withSteals, before, {
      ours: true,
      orderIndex: slot,
      outcome,
      fouled: play.fouled === true,
      swingingStrikeOutLost: play.swingingStrikeOutLost === true,
      strikes: play.strikes,
      balls: play.balls,
    }),
  )
  return withSteals
}
