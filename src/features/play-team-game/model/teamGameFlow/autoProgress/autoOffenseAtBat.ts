import type { RandomPort } from '@/shared/api/random/randomPort'
import { type QuickPlateAppearanceInput, playQuickPlateAppearance } from '@/entities/game/model/quickPlateAppearance'
import { runnersOfGame } from '@/entities/game/model/gameState'
import type { QuickAtBatPitcher } from '@/entities/game/model/quickAtBat'
import {
  entryQuickBatterOf,
  entryQuickPitcherOf,
  entryQuickTiredOf,
  quickPitcherDrainOf,
} from '@/features/play-team-game/model/teamGameFlow/autoPlay/quickEntries'
import { withQuickOffenseSettlement } from '@/features/play-team-game/model/teamGameFlow/autoProgress/quickOffenseSettlement'
import { quickAtBatRelayTickOf } from '@/features/play-team-game/model/teamGameFlow/autoProgress/relayTick'
import { opponentTeamMoraleOf } from '@/features/play-team-game/model/teamGameFlow/context/abilityContext'
import { entryBatterIntimidatesAt } from '@/features/play-team-game/model/teamGameFlow/roster/batters'
import { opponentPitcherStaminaAbility, pitcherSkillFlagsAt } from '@/features/play-team-game/model/teamGameFlow/roster/pitchers'
import type { TeamAutoRelayTick, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 자동으로 넘기는 우리 타석 — 원본도 같은 간이 엔진을 쓴다 (0xc11f0). 0xc262c 머리의 교체 판정 0xc1ba4(우리가 공격 중이면
 * **상대 투수**를 본다)는 부르는 쪽이 먼저 다 지났다(`playAutoAtBat` · `playAutoTick`).
 */
export function playAutoOffenseAtBat(progress: TeamGameProgress, random: RandomPort, relay?: TeamAutoRelayTick[]): TeamGameProgress {
  // 이어 c26b6 0xa5bcc 가 대타 홈런 칸 ctx+0x160 을 지운다 — 간이 엔진 타석은 기록 5 를 못 낸다
  const ready = progress.pinchHitHomeRunHalf === null ? progress : { ...progress, pinchHitHomeRunHalf: null }
  const pitcher = entryQuickPitcherOf(ready, ready.options.opponentTeamId, ready.opponentPitcherIndex)
  const drain = opponentQuickDrainOf(ready, pitcher)
  const appearance = playQuickPlateAppearance(quickOffenseInputOf(ready, pitcher, drain.beforePitch), random)
  const result = withQuickOffenseSettlement(ready, appearance, drain.stamina())
  relay?.push(quickAtBatRelayTickOf(result, ready.game, true, ready.game.battingOrderIndex, appearance.play.outcome, appearance))
  return result
}

/** 상대 마운드 투수 — 공마다 `beforePitch` 가 소모 뒤 체력%와 그 체력%로 부른 피로 능력을 실은 투수를 낸다 (굴림 없음) */
function opponentQuickDrainOf(progress: TeamGameProgress, pitcher: QuickAtBatPitcher) {
  const { options } = progress
  const pitcherSlot = progress.opponentPitcherIndex
  return quickPitcherDrainOf(
    pitcher,
    progress.opponentStamina,
    opponentPitcherStaminaAbility(progress),
    opponentTeamMoraleOf(options),
    progress.opponentUsedPitchers.length === 0,
    pitcherSkillFlagsAt(progress, options.opponentTeamId, pitcherSlot),
    entryBatterIntimidatesAt(progress, options.ourTeamId, progress.game.battingOrderIndex),
    (percent: number) => entryQuickTiredOf(progress, options.opponentTeamId, pitcherSlot, percent),
  )
}

function quickOffenseInputOf(
  progress: TeamGameProgress,
  pitcher: QuickAtBatPitcher,
  beforePitch: QuickPlateAppearanceInput['beforePitch'],
): QuickPlateAppearanceInput {
  const { options } = progress
  const before = progress.game
  const order = before.battingOrderIndex
  return {
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
    beforePitch,
  }
}
