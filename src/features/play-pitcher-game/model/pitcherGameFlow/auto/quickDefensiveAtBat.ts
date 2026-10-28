import { runnersOfGame } from '@/entities/game/model/gameState'
import { playQuickPlateAppearance, type QuickPlateAppearance } from '@/entities/game/model/quickPlateAppearance'
import { facingPitcherOf } from '@/entities/game/model/simulateHalfInning'
import { lineupSlotOf, rosterSlotAt } from '@/entities/game/model/quickLineup'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { outsAddedBetween } from '@/entities/game/model/gamePitcherLines'
import { withOpponentRecordTouched } from '@/features/play-pitcher-game/model/pitcherGameFlow/atBat/prepareAtBat'
import { ourQuickDefenseOf } from '@/features/play-pitcher-game/model/pitcherGameFlow/auto/quickDefense'
import {
  perPitchDrainOf,
  quickAtBatRelayTickOf,
  relayTickOf,
  runQuickSubstitutions,
  withMoundsPitched,
} from '@/features/play-pitcher-game/model/pitcherGameFlow/auto/quickPitching'
import { opponentQuickBatterOf, quickBatterOfTeam } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/opponentBatters'
import { chargeCpuPitcherLine } from '@/features/play-pitcher-game/model/pitcherGameFlow/roster/pitcherLines'
import { applyDefensivePlay } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/defensivePlay'
import { withLeagueSteals } from '@/features/play-pitcher-game/model/pitcherGameFlow/settlement/leagueRecords'
import { MAXIMUM_PITCHER_COUNTER } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/constants'
import { isHalfInningChanged } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/halfInning'
import type { PitcherAutoRelayTick, PitcherGameProgress } from '@/features/play-pitcher-game/model/pitcherGameFlow/shared/progressTypes'

/**
 * 내가 마운드에 없는 수비 타석은 간이 엔진이 돈다 (0xc262c → 0xc11f0).
 * 원본도 타석 하나씩 돌리므로 반 이닝을 뭉뚱그리지 않는다.
 *
 * 타석 앞에서 `0xc1ba4` 가 상대(공격) CPU 대타 → 우리(수비) 투수 교체를 본다 (`runQuickSubstitutions`). 우리 투수는
 * 내가 아닌 우리 마운드 투수(`ourMound`)이고 투구마다 스태미나가 깎인다 (0xa5e14, c26ca).
 */
export function playDefensiveAtBat(
  progress: PitcherGameProgress,
  random: RandomPort,
  /** 자동진행 중계 틱을 여기 쌓는다 (`autoRelay`) */
  relay?: PitcherAutoRelayTick[],
): PitcherGameProgress {
  const substituted = runQuickSubstitutions(progress, false, random, (after, before) => relay?.push(relayTickOf(after, before, null)))
  const rolled = rollOpponentAppearance(substituted, random)
  const { play } = rolled.appearance
  const played = applyDefensivePlay(
    {
      ...substituted,
      atBatPitches: play.pitches,
      halfInningPitches: substituted.halfInningPitches + play.pitches,
      // 간이 엔진도 공마다 0xa5e14 를 부른다 (c26ca) — state[0xe]·state[0xd] 가 내려간다
      pinchHitUsed: false,
      ...withMoundsPitched(substituted),
    },
    play.outcome,
    false,
    play.balls,
    // 내가 마운드에 없는 타석은 간이 엔진이라 수비 시뮬레이션도 재생거리도 없다
    { defensePlay: null, playback: null, quick: rolled.appearance },
  )
  const result = withOurQuickMoundAfter(played, substituted, play, rolled.ourStamina())
  // 0xc1a42 — 간이 타석 도루 주자마다 0xa56dc(ctx, 주자, 0) 참이면 +0x2c (상대 팀 주자)
  // 상대(공격) 레코드 +2 는 스윙 경로 0xab214 · 주자 있는 판정 경로 c19ec 에서만 덮인다 (`touchesOffenseRecord`)
  const touched = rolled.appearance.touchesOffenseRecord ? withOpponentRecordTouched(result) : result
  const withSteals = withLeagueSteals(touched, false, rolled.appearance.stolenRunners)
  relay?.push(quickAtBatRelayTickOf(withSteals, substituted.game, { ours: false, orderIndex: substituted.opponentOrderIndex }, play))
  return withSteals
}

/** 내가 마운드에 없는 수비 타석은 자동진행(0x21) 안의 간이 타석 — 상태 0xf 를 안 지나 돌발을 굴리지 않는다 */
function rollOpponentAppearance(progress: PitcherGameProgress, random: RandomPort) {
  const { options } = progress
  const mound = progress.ourMound
  const defense = ourQuickDefenseOf(progress)
  const order = progress.opponentOrderIndex
  const batter = opponentQuickBatterOf(progress)
  const pitched = perPitchDrainOf(defense, mound, batter)
  const appearance = playQuickPlateAppearance(
    {
      batter,
      // 간이 엔진이 보는 투수 체력은 체력%(0xaebb0)다 — 마운드의 살아 있는 값과 그 체력%로 부른 피로 능력(0xb58e6)
      pitcher: facingPitcherOf(defense, mound.pitcherSlot, staminaPercentOf(mound.stamina)),
      situation: {
        inning: progress.game.inning,
        // 전역 모드 3 · 수비(우리 팀)가 사람 팀(0x3a20a) — 모드 3·4 라 수비 사람 −10 은 안 걸린다(0xab5c0)
        mode: '나만의리그',
        isDefenseHuman: true,
        careerYearIndex: options.careerYearIndex ?? 0,
        // 0xab966 — 수비(우리) 점수 > 공격(상대) 점수
        isLosing: progress.game.ourScore > progress.game.opponentScore,
        recentAtBatCodes: progress.opponentLineup.records[lineupSlotOf(order)]?.results ?? [],
      },
      bases: progress.game.bases,
      outs: progress.game.outs,
      // 루에 선 주자의 신원(상대 타순 칸) — 도루 판정은 앞선 주자의 주력
      runners: runnersOfGame(progress.game, order),
      batterId: lineupSlotOf(order),
      runnerRunOf: (runner) => quickBatterOfTeam(options, false, rosterSlotAt(progress.opponentLineup, runner)).run,
      beforePitch: pitched.beforePitch,
    },
    random,
  )
  // 공마다 이미 깎았다 (`beforePitch`, 0xc262c 의 c26c8)
  return { appearance, ourStamina: pitched.stamina }
}

/**
 * 정산 0xa8024 — 우리 마운드 CPU 투수 레코드에 아웃·탈삼진 (내 투수는 커리어가 따로 센다). 실점은 `applyDefensivePlay` 가
 * 들어온 주자의 책임 투수(주자+0x30)에게 이미 매겼다. 반 이닝 교대 0xa5b00 이 A 를 0 으로
 */
function withOurQuickMoundAfter(
  played: PitcherGameProgress,
  before: PitcherGameProgress,
  play: QuickPlateAppearance['play'],
  ourStamina: number,
): PitcherGameProgress {
  const mound = before.ourMound
  const runs = played.game.opponentScore - before.game.opponentScore
  return {
    ...played,
    pitcherLines: chargeCpuPitcherLine(played.pitcherLines, before.options.ourTeamId, mound.pitcherSlot, {
      outs: outsAddedBetween(before.game, played.game),
      strikeouts: play.outcome.kind === '삼진' ? 1 : 0,
    }),
    ourMound: {
      ...played.ourMound,
      stamina: ourStamina,
      runsAllowed: Math.min(MAXIMUM_PITCHER_COUNTER, mound.runsAllowed + runs),
      pitches: mound.pitches + play.pitches,
    },
    ourInningRunsAllowed: isHalfInningChanged(before.game, played.game) ? 0 : Math.min(MAXIMUM_PITCHER_COUNTER, before.ourInningRunsAllowed + runs),
  }
}
