import type { RandomPort } from '@/shared/api/random/randomPort'
import { MAGIC_PITCH_TYPE_NUMBER } from '@/entities/pitcher-career/model/magicPitch'
import { type PitcherStats, drainStamina } from '@/features/play-pitcher-game/model/pitcherPitch'
import { staminaPercentOf } from '@/entities/pitcher-career/model/pitcherStamina'
import { rollCpuStealStartOnOurDefense } from '@/features/play-team-game/model/teamGameFlow/baseRunning/cpuStealStart'
import { ourTeamMoraleOf } from '@/features/play-team-game/model/teamGameFlow/context/abilityContext'
import { rollCpuBatterReaction } from '@/features/play-team-game/model/teamGameFlow/pitching/cpuBatterReaction'
import { finishOurThrow } from '@/features/play-team-game/model/teamGameFlow/pitching/finishOurThrow'
import { ourFatiguedStatsOf } from '@/features/play-team-game/model/teamGameFlow/pitching/ourFatiguedStats'
import { withOurPitchThrown } from '@/features/play-team-game/model/teamGameFlow/pitching/recordOurPitch'
import { type OurPitcherCondition, rollOurPitch } from '@/features/play-team-game/model/teamGameFlow/pitching/rollOurPitch'
import { entryBatterIntimidatesAt } from '@/features/play-team-game/model/teamGameFlow/roster/batters'
import { ourPitcherStats } from '@/features/play-team-game/model/teamGameFlow/roster/currentPitcher'
import { pitcherRepertoireAt, pitcherSkillFlagsAt } from '@/features/play-team-game/model/teamGameFlow/roster/pitchers'
import { isPitchTurn } from '@/features/play-team-game/model/teamGameFlow/turn/turns'
import type { TeamPitchInput } from '@/features/play-team-game/model/teamGameFlow/types/plays'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * **사람 투수의 공 하나** (상태 0x10 확정 → 0x11 → 0x12/0x13). 굴림 차례:
 * 공 굴림 셋(등급 · 놓기 · 실투, `rollOurPitch`) → CPU 도루 출발 · 송구 결정 → CPU 타자 결정 0x34334 → 판 · 공 도착.
 * `defer` 가 참이면 인플레이 타구에서 멈춘다 — 그 밖은 예전처럼 타구까지 한 번에 돌린다
 */
export function pitchOnce(
  progress: TeamGameProgress,
  input: TeamPitchInput,
  random: RandomPort,
  defer: boolean,
  holdsArrival = false,
): TeamGameProgress {
  if (!canThrowOurPitch(progress, input)) return progress
  const stamina = drainedOurStaminaOf(progress, input.typeNumber)
  const condition = ourPitcherConditionOf(progress, stamina)
  const rolled = rollOurPitch(progress, input, condition, random)
  const steal = rollCpuStealStartOnOurDefense(progress, random)
  const thrown = rollCpuBatterReaction(progress, rolled, condition, random)
  const afterPitch = withOurPitchThrown(progress, { stamina, rolled, thrown, steal })
  return finishOurThrow(afterPitch, thrown, rolled.pitch, random, defer, holdsArrival)
}

/** 사람이 던질 차례이고 붙든 공이 없으며, 마구면 남은 횟수가 있다 */
function canThrowOurPitch(progress: TeamGameProgress, input: TeamPitchInput): boolean {
  if (!isPitchTurn(progress) || progress.pendingPitchArrival != null) return false
  return input.typeNumber !== MAGIC_PITCH_TYPE_NUMBER || progress.magicRemaining > 0
}

function drainedOurStaminaOf(progress: TeamGameProgress, typeNumber: number): number {
  const { options } = progress
  // 스태미나 소모 0xa5e14 — 상태 0x11 **진입** 0x3de10 의 0x3dec6 이다. 놓기 0x4dc78(0x11 의 틱 10)보다 앞이라
  // 등급 굴림 0x4dbac · 피로 능력치 0x34968 · CPU 타자 스윙 0xab214 가 모두 **이번 공을 깎은 뒤**의 체력을 본다.
  // 스태미나는 게이지 결과와 무관하다 — 인자가 (game, 구질) 뿐이다 (P1 3-1 확정)
  return drainStamina({
    stamina: progress.stamina,
    typeNumber,
    staminaAbility: ourPitcherStats(progress).stamina,
    teamMorale: ourTeamMoraleOf(options),
    // 0xaeb08 `team+0x26 − team+0x33 == 1` — 마운드를 밟은 투수가 지금 투수 하나뿐일 때만 첫 투수 보너스(0x66e44 +200).
    // 교체로 올라온 구원 투수는 받지 않는다 (P1 3-2, 상대 쪽 `throwOpponentPitch` 와 같은 식)
    isFirstPitcher: progress.ourUsedPitchers.length === 0,
    // 상대 지금 타자의 0xb62b4(타자, 22) 압도 — 레코드 +0x14 (`TeamEntryBatter.skillBits`)
    batterIntimidates: entryBatterIntimidatesAt(progress, options.opponentTeamId, progress.opponentOrderIndex),
    ...pitcherSkillFlagsAt(progress, options.ourTeamId, progress.ourPitcherIndex),
  })
}

/** 이번 공을 깎은 뒤의 체력으로 부른 우리 투수 — 등급 · 놓기 · CPU 타자 스윙이 모두 이 값을 본다 */
function ourPitcherConditionOf(progress: TeamGameProgress, stamina: number): OurPitcherCondition {
  const stats: PitcherStats = ourPitcherStats(progress)
  return {
    stats,
    fatigued: ourFatiguedStatsOf(progress, stats, stamina),
    staminaPercent: staminaPercentOf(stamina),
    repertoire: pitcherRepertoireAt(progress, progress.options.ourTeamId, progress.ourPitcherIndex),
  }
}
