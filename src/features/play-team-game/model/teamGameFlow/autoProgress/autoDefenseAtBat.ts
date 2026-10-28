import type { RandomPort } from '@/shared/api/random/randomPort'
import { playQuickPlateAppearance } from '@/entities/game/model/quickPlateAppearance'
import { runnersOfGame } from '@/entities/game/model/gameState'
import { createAtBat } from '@/entities/at-bat/model/atBatState'
import {
  entryQuickBatterOf,
  entryQuickPitcherOf,
  entryQuickTiredOf,
  quickPitcherDrainOf,
} from '@/features/play-team-game/model/teamGameFlow/autoPlay/quickEntries'
import { quickAtBatRelayTickOf } from '@/features/play-team-game/model/teamGameFlow/autoProgress/relayTick'
import { ourTeamMoraleOf } from '@/features/play-team-game/model/teamGameFlow/context/abilityContext'
import { finishDefensiveAtBat } from '@/features/play-team-game/model/teamGameFlow/defense/finishDefensiveAtBat'
import { withHalfInningPitches } from '@/features/play-team-game/model/teamGameFlow/records/atBatRecords'
import { entryBatterIntimidatesAt } from '@/features/play-team-game/model/teamGameFlow/roster/batters'
import { ourPitcherStats } from '@/features/play-team-game/model/teamGameFlow/roster/currentPitcher'
import { pitcherSkillFlagsAt } from '@/features/play-team-game/model/teamGameFlow/roster/pitchers'
import { chargeMoundLine } from '@/features/play-team-game/model/teamGameFlow/settlement/pitcherLines'
import type { TeamAutoRelayTick, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/** 자동으로 넘기는 상대 타석 */
export function playAutoDefenseAtBat(progress: TeamGameProgress, random: RandomPort, relay?: TeamAutoRelayTick[]): TeamGameProgress {
  // 0xc1ba4(CPU 대타 = 상대 팀 · **우리 투수** 교체 판정)는 부르는 쪽이 먼저 다 지났다
  const { options } = progress
  const pitcherSlot = progress.ourPitcherIndex
  const tiredAt = (percent: number) => entryQuickTiredOf(progress, options.ourTeamId, pitcherSlot, percent)
  const pitcher = entryQuickPitcherOf(progress, options.ourTeamId, pitcherSlot)
  const drain = quickPitcherDrainOf(
    pitcher,
    progress.stamina,
    ourPitcherStats(progress).stamina,
    ourTeamMoraleOf(progress.options),
    progress.ourUsedPitchers.length === 0,
    pitcherSkillFlagsAt(progress, options.ourTeamId, pitcherSlot),
    entryBatterIntimidatesAt(progress, options.opponentTeamId, progress.opponentOrderIndex),
    tiredAt,
  )
  const before = progress.game
  const orderIndex = progress.opponentOrderIndex
  const appearance = playQuickPlateAppearance(
    {
      batter: entryQuickBatterOf(progress, options.opponentTeamId, orderIndex),
      // 공마다 `beforePitch` 가 소모 뒤 체력%와 그 체력%로 부른 피로 능력을 실은 투수를 낸다
      pitcher,
      situation: {
        inning: before.inning,
        // 판정 묶음 '일반' — 수비(우리 팀)가 사람 팀이라 자동진행이어도 hit · power 쪽 −10(0xab5c0). 상대 공격 팀은 대전모드
        // (8·9)에서도 CPU 라 우리 자동 타석에 −10 이 걸리지 않는다(`TeamGameOptions.mode` 주석 — 조작 칸)
        mode: '일반',
        isDefenseHuman: true,
        // 0xab966 — 수비(우리) 점수 > 공격(상대) 점수
        isLosing: before.ourScore > before.opponentScore,
        recentAtBatCodes: progress.opponentEntryRecords[orderIndex]?.results ?? [],
      },
      bases: before.bases,
      outs: before.outs,
      // 루에 선 주자의 신원(상대 타순 칸) — 도루 판정은 앞선 주자의 주력
      runners: runnersOfGame(before, orderIndex),
      batterId: orderIndex,
      runnerRunOf: (runner) => entryQuickBatterOf(progress, options.opponentTeamId, runner).run,
      beforePitch: drain.beforePitch,
    },
    random,
  )
  const play = appearance.play
  // 사람 수비가 아닌 간이 타석 — 판도 재생거리도 없다(`startDefensiveAtBat` 의 mine = false 갈래와 같다)
  const result = finishDefensiveAtBat(
    {
      ...progress,
      // 간이 엔진도 공마다 0xa5e14 가 이 타석·반 이닝 투구 수(ctx+0x161·+0x16c)를 올리고, 0xc1818 이 볼카운트
      // state[4]·[5] 를 쓴다 — 삼진(0xa7c4c)·아웃(0xa7d0c) 기록 판정이 그 값을 본다
      recordTally: withHalfInningPitches({ ...progress.recordTally, atBatPitches: play.pitches }, progress.game, play.pitches),
      atBat: createAtBat({ balls: play.balls, strikes: 0 }),
      // 투구마다 state[0xd]·state[0xe] 가 내려간다 (0xa5e14 의 a5e72·a5e7c, c26ca)
      pitcherJustChanged: false,
      cpuPinchHitUsed: false,
      // 공마다 이미 깎았다 (위 `beforePitch`)
      stamina: drain.stamina(),
      pitcherLines: chargeMoundLine(progress, true, { pitches: play.pitches }),
      // 출발 칸은 사람 도루 키 몫 — 간이 타석에는 없다(`startDefensiveAtBat` 의 `withoutSteal`)
      stealingFrom: [],
    },
    play.outcome,
    false,
    null,
    null,
    { advance: appearance.advance, runners: appearance.runners, stolenRunners: appearance.stolenRunners },
  )
  relay?.push(quickAtBatRelayTickOf(result, before, false, orderIndex, play.outcome, appearance))
  return result
}
