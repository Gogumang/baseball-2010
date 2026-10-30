import type { RandomPort } from '@/shared/api/random/randomPort'
import { withLineupRecordSlot, rosterSlotAt, lineupSlotOf } from '@/entities/game/model/quickLineup'
import { playQuickPlateAppearance, type QuickPlateAppearanceInput } from '@/entities/game/model/quickPlateAppearance'
import { facingPitcherOf, type HalfInningDefense } from '@/entities/game/model/simulateHalfInning'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { runnersOfGame, applyAtBatOutcome } from '@/entities/game/model/gameState'
import { describeOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { teammateAppearanceProgressOf } from '@/features/play-game/model/gameFlow/autoPlay/teammateAtBat/teammateProgress'
import { substitutionRelayTickOf, teammateRelayTickOf } from '@/features/play-game/model/gameFlow/autoPlay/teammateAtBat/teammateRelay'
import { ourRunnerRunOf } from '@/features/play-game/model/gameFlow/baseRunning/runners'
import { appendLog } from '@/features/play-game/model/gameFlow/log/appendLog'
import { opponentQuickDefenseOf } from '@/features/play-game/model/gameFlow/quick/quickDefense'
import { perPitchDrainOf } from '@/features/play-game/model/gameFlow/quick/stamina'
import { teamBatterAt } from '@/features/play-game/model/gameFlow/roster/teamPlayers'
import { applyOurCpuPinchHit, changeOpponentPitcher } from '@/features/play-game/model/gameFlow/substitution/cpuSubstitution'
import { MAXIMUM_SUBSTITUTION_CALLS } from '@/features/play-game/model/gameFlow/types/constants'
import type { GameAutoRelayTick, GameProgress } from '@/features/play-game/model/gameFlow/types/progress'

/**
 * 0xc262c 는 타석마다 먼저 0xc1ba4 를 부른다 — CPU 대타(공격 = 우리 팀, 0xc1c50) 뒤 CPU 투수 교체
 * (우리가 공격 중이니 **상대 투수**, 0xc1ce2). 하나라도 바뀌면 0xc262c 가 공 없이 돌아갔다가(c266c) 같은
 * 타석으로 0xc1ba4 를 다시 지난다 — 바뀐 쪽은 state[0xe]·state[0xd] 로 빠지고 안 바뀐 쪽은 다시 판정한다
 */
function rollTeammateSubstitutions(progress: GameProgress, random: RandomPort, relay: GameAutoRelayTick[] | undefined): GameProgress {
  let current = progress
  for (let call = 0; call < MAXIMUM_SUBSTITUTION_CALLS; call += 1) {
    const substituted = changeOpponentPitcher(applyOurCpuPinchHit(current, random), random, false)
    if (substituted === current) break
    current = substituted
    relay?.push(substitutionRelayTickOf(current))
  }
  return current
}

/** 간이 엔진 타석 입력 — 우리 팀 명단의 실제 능력치 · 상대 마운드 */
function teammateAppearanceInputOf(
  progress: GameProgress,
  opponentDefense: HalfInningDefense,
  batter: QuickPlateAppearanceInput['batter'],
  beforePitch: QuickPlateAppearanceInput['beforePitch'],
): QuickPlateAppearanceInput {
  const mound = progress.opponentMound
  const order = progress.game.battingOrderIndex
  return {
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
    beforePitch,
  }
}

/** 동료 타석도 원본은 같은 간이 타석 엔진을 쓴다 — 우리 팀 명단의 실제 능력치가 들어간다 */
export function playTeammateAtBat(progress: GameProgress, random: RandomPort, relay?: GameAutoRelayTick[]): GameProgress {
  const current = rollTeammateSubstitutions(progress, random, relay)
  // 동료 타석은 자동진행(0x21) 안의 간이 타석이라 상태 0xf 를 안 지난다 — 돌발 굴림(0x8f158)·판정(0x8f414) 없음
  const opponentDefense = opponentQuickDefenseOf(current)
  const order = current.game.battingOrderIndex
  const batter = withLineupRecordSlot(teamBatterAt(current, true, rosterSlotAt(current.ourLineup, order)), current.ourLineup, order)
  const pitched = perPitchDrainOf(opponentDefense, current.opponentMound, batter)
  const appearance = playQuickPlateAppearance(teammateAppearanceInputOf(current, opponentDefense, batter, pitched.beforePitch), random)
  const outcome = appearance.play.outcome
  // 동료 타석은 원본도 간이 엔진(0xc262c)이 돌린다 — **간이 엔진에는 희생플라이가 없다** (E-2 확정).
  // 볼넷(모든 주자 +1, c1918) · 도루(c1982) · 땅볼 진루(0xc15b8)는 `playQuickPlateAppearance` 가 먹였다
  const game = applyAtBatOutcome(current.game, outcome, appearance.advance, { runners: appearance.runners })
  relay?.push(teammateRelayTickOf(current, game, appearance.play))
  const runsBattedIn = game.ourScore - current.game.ourScore
  return appendLog(
    teammateAppearanceProgressOf(current, appearance, game, pitched.stamina),
    `${current.game.inning}회${current.game.half} ${current.game.battingOrderIndex + 1}번 — ${describeOutcome(outcome)}${
      runsBattedIn > 0 ? ` (${runsBattedIn}점)` : ''
    }`,
    false,
  )
}
