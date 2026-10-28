import type { RandomPort } from '@/shared/api/random/randomPort'
import { withLineupRecordSlot, rosterSlotAt, lineupSlotOf, recordLineupPlay } from '@/entities/game/model/quickLineup'
import { playQuickPlateAppearance } from '@/entities/game/model/quickPlateAppearance'
import { facingPitcherOf } from '@/entities/game/model/simulateHalfInning'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { runnersOfGame, applyAtBatOutcome } from '@/entities/game/model/gameState'
import { recordBatterAtBat, EMPTY_BATTER_GAME_LOG } from '@/entities/game/model/batterGameLog'
import { backToBackRecordOf } from '@/entities/game/model/gameRecords'
import { teamRecordMoraleOf } from '@/entities/team/model/teamMorale'
import { decisionsAfterPlay } from '@/features/play-game/model/gameDecisions'
import { chargePitcherLine, outsAddedBetween } from '@/entities/game/model/gamePitcherLines'
import { scoredFromBasesOf } from '@/entities/game/model/runnerPitchers'
import { describeOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { drawnRelayGameOf } from '@/features/play-game/model/gameFlow/autoPlay/relayGame'
import { ourRunnerRunOf } from '@/features/play-game/model/gameFlow/baseRunning/runners'
import { appendLog } from '@/features/play-game/model/gameFlow/log/appendLog'
import { opponentQuickDefenseOf } from '@/features/play-game/model/gameFlow/quick/quickDefense'
import { perPitchDrainOf } from '@/features/play-game/model/gameFlow/quick/stamina'
import { teamBatterAt } from '@/features/play-game/model/gameFlow/roster/teamPlayers'
import { chargeOpponentRunsOf } from '@/features/play-game/model/gameFlow/settlement/chargeRuns'
import { moundsOf } from '@/features/play-game/model/gameFlow/settlement/decisions'
import { applyOurCpuPinchHit, changeOpponentPitcher } from '@/features/play-game/model/gameFlow/substitution/cpuSubstitution'
import { MAXIMUM_PITCHER_COUNTER, MAXIMUM_SUBSTITUTION_CALLS } from '@/features/play-game/model/gameFlow/types/constants'
import type { GameAutoRelayTick, GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/** 동료 타석도 원본은 같은 간이 타석 엔진을 쓴다 — 우리 팀 명단의 실제 능력치가 들어간다 */
export function playTeammateAtBat(progress: GameProgress, random: RandomPort, relay?: GameAutoRelayTick[]): GameProgress {
  // 0xc262c 는 타석마다 먼저 0xc1ba4 를 부른다 — CPU 대타(공격 = 우리 팀, 0xc1c50) 뒤 CPU 투수 교체
  // (우리가 공격 중이니 **상대 투수**, 0xc1ce2). 하나라도 바뀌면 0xc262c 가 공 없이 돌아갔다가(c266c) 같은
  // 타석으로 0xc1ba4 를 다시 지난다 — 바뀐 쪽은 state[0xe]·state[0xd] 로 빠지고 안 바뀐 쪽은 다시 판정한다
  for (let call = 0; call < MAXIMUM_SUBSTITUTION_CALLS; call += 1) {
    const substituted = changeOpponentPitcher(applyOurCpuPinchHit(progress, random), random, false)
    if (substituted === progress) break
    progress = substituted
    // 0x21 의 한 틱 — 공 없이 돌아간 부름(글 없음)
    relay?.push({
      progress,
      game: progress.game,
      offenseOurs: true,
      orderIndex: progress.game.battingOrderIndex,
      lineup: progress.ourLineup,
      pitcherSlot: progress.opponentMound.pitcherSlot,
      atBat: null,
    })
  }
  // 동료 타석은 자동진행(0x21) 안의 간이 타석이라 상태 0xf 를 안 지난다 — 돌발 굴림(0x8f158)·판정(0x8f414) 없음
  const opponentDefense = opponentQuickDefenseOf(progress)
  const mound = progress.opponentMound
  const order = progress.game.battingOrderIndex
  const batter = withLineupRecordSlot(teamBatterAt(progress, true, rosterSlotAt(progress.ourLineup, order)), progress.ourLineup, order)
  const pitched = perPitchDrainOf(opponentDefense, mound, batter)
  const appearance = playQuickPlateAppearance(
    {
      batter,
      // 간이 엔진이 보는 투수 체력은 체력%(0xaebb0)다 — 마운드의 살아 있는 값과 그 체력%로 부른 피로 능력(0xb58e6)
      pitcher: facingPitcherOf(opponentDefense, mound.pitcherSlot, staminaPercentOf(mound.stamina)),
      situation: {
        inning: progress.game.inning,
        // 0xab214 는 전역 모드(0x1552d10 = 4)와 state[0x31 + 측]을 읽는다 — 모드 4 경기 준비 0x3a20a 가 내 팀을 사람 팀으로 적는다
        mode: '나만의리그',
        isOffenseHuman: true,
        // 0xab966 — 수비(상대) 점수 > 공격(우리) 점수
        isLosing: progress.game.opponentScore > progress.game.ourScore,
        // 이 타순 칸의 오늘 타석 결과 링 (팀 객체 + 타순×0x18 + 0x34)
        recentAtBatCodes: progress.ourLineup.records[lineupSlotOf(order)]?.results ?? [],
      },
      bases: progress.game.bases,
      outs: progress.game.outs,
      // 루에 선 주자의 신원(우리 타순 칸) — 내가 루에 있으면 내 주력
      runners: runnersOfGame(progress.game),
      batterId: lineupSlotOf(order),
      runnerRunOf: (runner) => ourRunnerRunOf(progress, runner),
      beforePitch: pitched.beforePitch,
    },
    random,
  )
  const play = appearance.play
  const outcome = play.outcome
  // 동료 타석은 원본도 간이 엔진(0xc262c)이 돌린다 — **간이 엔진에는 희생플라이가 없다** (E-2 확정).
  // 볼넷(모든 주자 +1, c1918) · 도루(c1982) · 땅볼 진루(0xc15b8)는 `playQuickPlateAppearance` 가 먹였다
  const game = applyAtBatOutcome(progress.game, outcome, appearance.advance, { runners: appearance.runners })
  // 0xc1a42~0xc1a98 — 도루에 성공한 주자마다 0xa56dc(ctx, 주자, 0) 참이면 +0x2c. 내가 루에 있었으면 내 기록(124 타자 열 0x40)으로,
  // 동료는 리그 기록표로(마타자 칸은 summary 가 뺀다). 포스트시즌 거르기는 커리어에 먹이는 쪽이 한다
  const stolenSlots = appearance.stolenRunners
  const myStolenBases = stolenSlots.filter((stolenSlot) => stolenSlot === progress.game.playerOrderIndex).length
  const teammateSteals = stolenSlots
    .filter((stolenSlot) => stolenSlot !== progress.game.playerOrderIndex)
    .map((stolenSlot) => ({ teamId: progress.ourTeamId, battingOrderIndex: rosterSlotAt(progress.ourLineup, stolenSlot) }))
  const runsBattedIn = game.ourScore - progress.game.ourScore
  const slot = progress.game.battingOrderIndex
  const recorded = recordBatterAtBat(progress.teammateLogs[slot] ?? EMPTY_BATTER_GAME_LOG, outcome, runsBattedIn)
  // 간이 엔진 타석도 0xa8024 를 지난다 — 동료 홈런도 같은 팀 카운터로 이어 센다 (0xa794c)
  const backToBack = backToBackRecordOf({
    streak: progress.homeRunStreak,
    humanOffense: true,
    isHomeRun: outcome.kind === '홈런',
  })
  relay?.push({
    progress,
    game: drawnRelayGameOf(game, progress.game),
    offenseOurs: true,
    orderIndex: slot,
    lineup: progress.ourLineup,
    pitcherSlot: mound.pitcherSlot,
    atBat: {
      rosterSlot: rosterSlotAt(progress.ourLineup, slot),
      outcome,
      fouled: play.fouled === true,
      swingingStrikeOutLost: play.swingingStrikeOutLost === true,
      strikes: play.strikes,
      balls: play.balls,
    },
  })

  return appendLog(
    {
      ...progress,
      game,
      // 간이 타석의 공마다 c1446 · c1852 가 상대(수비) 레코드 +2 를 덮는다 (`GameProgress.opponentRecordMorale`)
      opponentRecordMorale: progress.teamMorale ?? teamRecordMoraleOf(progress.opponentTeamId),
      // 간이 엔진 득점(0xc0fb4·0xc1054)도 같은 0xa5c34 를 부른다
      decisions: decisionsAfterPlay(progress.decisions, progress.game, game, moundsOf(progress)),
      teammateLogs: { ...progress.teammateLogs, [slot]: recorded.log },
      ourLineup: recordLineupPlay(progress.ourLineup, slot, outcome, { quickEngine: true }),
      // 실점은 들어온 주자의 책임 투수에게 (0xa8ee4) — 간이 엔진 주자는 죽지 않아 빠진 앞선 주자가 들어온 주자다
      ...chargeOpponentRunsOf(
        progress,
        chargePitcherLine(progress.pitcherLines, progress.opponentTeamId, mound.pitcherSlot, {
          outs: outsAddedBetween(progress.game, game),
          strikeouts: outcome.kind === '삼진' ? 1 : 0,
        }),
        game,
        lineupSlotOf(order),
        scoredFromBasesOf(runnersOfGame(progress.game), appearance.runners, runsBattedIn),
      ),
      opponentMound: {
        ...mound,
        // 공마다 이미 깎았다 (위 `beforePitch`, 0xc262c 의 c26c8)
        stamina: pitched.stamina(),
        runsAllowed: Math.min(MAXIMUM_PITCHER_COUNTER, mound.runsAllowed + runsBattedIn),
        pitches: mound.pitches + play.pitches,
        // 투구마다 state[0xd] 가 내려간다 (0xa5e72)
        justChanged: false,
      },
      // 같은 0xa5e14 가 state[0xe](CPU 대타 막음)도 내린다 (a5e7c)
      pinchHitUsed: false,
      opponentInningRunsAllowed: Math.min(MAXIMUM_PITCHER_COUNTER, progress.opponentInningRunsAllowed + runsBattedIn),
      recordIds: [...progress.recordIds, ...recorded.recordIds, ...backToBack.recordIds],
      homeRunStreak: backToBack.streak,
      ...(myStolenBases > 0 ? { myStats: { ...progress.myStats, stolenBases: (progress.myStats.stolenBases ?? 0) + myStolenBases } } : {}),
      ...(teammateSteals.length > 0 ? { leagueStolenBases: [...(progress.leagueStolenBases ?? []), ...teammateSteals] } : {}),
      // 동료 타석도 우리 팀 선수 레코드에 쌓인다 — 타순 칸이 곧 로스터 칸이다 (`batterAt` 과 같은 자리)
      leaguePlateAppearances: [
        ...progress.leaguePlateAppearances,
        {
          teamId: progress.ourTeamId,
          battingOrderIndex: rosterSlotAt(progress.ourLineup, slot),
          outcome,
          runsBattedIn,
        },
      ],
    },
    `${progress.game.inning}회${progress.game.half} ${progress.game.battingOrderIndex + 1}번 — ${describeOutcome(outcome)}${
      runsBattedIn > 0 ? ` (${runsBattedIn}점)` : ''
    }`,
    false,
  )
}
