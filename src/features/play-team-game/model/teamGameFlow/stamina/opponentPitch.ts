import { type MagicPitchGameState, advanceMagicPitchGameState } from '@/entities/pitching/model/magicPitchGame'
import { drainStamina } from '@/features/play-pitcher-game/model/pitcherPitch'
import { opponentTeamMoraleOf } from '@/features/play-team-game/model/teamGameFlow/context/abilityContext'
import { entryBatterIntimidatesAt } from '@/features/play-team-game/model/teamGameFlow/roster/batters'
import { opponentPitcherStaminaAbility, pitcherRepertoireAt, pitcherSkillFlagsAt } from '@/features/play-team-game/model/teamGameFlow/roster/pitchers'
import { addRunsToCounters, chargeMoundLine } from '@/features/play-team-game/model/teamGameFlow/settlement/pitcherLines'
import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow/types/progress'

/**
 * 사람 타석에서 **상대 CPU 투수가 공 하나를 던졌다** — 공이 손을 떠날 때(상태 0x11 진입 0x3de10 의 0x3dec6)
 * `0xa5e14(ctx, game+0xfc8 = 구질)` 이 수비 팀 투수를 깎는다 (P1 3-1, 4099ec6 과 같은 자리):
 *   투구 수 +1 (`team+0x27c` 묶음) · state[0xd] = 0 (`pitcherJustChanged`) · 스태미나 −c·용량 (0xaeb08)
 *   c = 0x66ef0(구질), 타자 스킬 22 압도 또는 투수 스킬 18 이면 ×2, 투수 스킬 10 이면 −1.
 * 용량 X 는 간이 타석 쪽(`quickPitcherDrainOf`)과 같은 입력이다 — 상대 팀 사기(`opponentTeamMoraleOf`) · 첫 투수 보너스(0x66e44).
 *
 * 타자 스킬 22 압도는 지금 타자 레코드 +0x14(`TeamEntryBatter.skillBits`, `entryBatterIntimidatesAt`)로 본다.
 * 구질이 없으면(`PitchOutcomeDetail.pitchTypeNumber` 를 안 실은 호출) 깎지 않는다. 난수는 쓰지 않는다.
 */
export function throwOpponentPitch(progress: TeamGameProgress, pitchTypeNumber: number | undefined): TeamGameProgress {
  if (pitchTypeNumber === undefined) return progress
  // 소모 0x345fc(`공+0x10 ≠ 0` 일 때만) → 싣기 0x3de10 — 타석 화면이 이 값의 사본으로 고른 구질을 같은 차례로 밟는다.
  // 공은 사람 투구와 함께 쓰는 한 칸이다 (`ballMagicNumber` 주석)
  const magic: MagicPitchGameState = {
    remaining: progress.opponentMagicRemaining,
    ballMagicNumber: progress.ballMagicNumber,
  }
  advanceMagicPitchGameState(
    magic,
    pitchTypeNumber,
    pitcherRepertoireAt(progress, progress.options.opponentTeamId, progress.opponentPitcherIndex).magicId,
  )
  return {
    ...progress,
    opponentMagicRemaining: magic.remaining,
    ballMagicNumber: magic.ballMagicNumber,
    opponentStamina: opponentStaminaAfterPitch(progress, pitchTypeNumber),
    opponentPitcherCounters: addRunsToCounters(progress.opponentPitcherCounters, 0, 1, false),
    pitcherLines: chargeMoundLine(progress, false, { pitches: 1 }),
    pitcherJustChanged: false,
    // 같은 0xa5e14 가 바로 뒤(a5e7c)에서 state[0xe] 도 내린다
    cpuPinchHitUsed: false,
    // 같은 0xa5e14 가 정산 사건 목록을 비운다 (a5e80 ctx+0x2c = 0)
    pendingSettlementEvents: undefined,
  }
}

/** 상대 CPU 투수가 이 구질을 던져 깎은 뒤의 +0x2c (0xa5e14 → 0xaeb08) — `throwOpponentPitch` 와 타석 화면의 투구 AI 가 함께 쓴다 */
export function opponentStaminaAfterPitch(progress: TeamGameProgress, pitchTypeNumber: number): number {
  return drainStamina({
    stamina: progress.opponentStamina,
    typeNumber: pitchTypeNumber,
    staminaAbility: opponentPitcherStaminaAbility(progress),
    teamMorale: opponentTeamMoraleOf(progress.options),
    isFirstPitcher: progress.opponentUsedPitchers.length === 0,
    // 공격 팀 지금 타자(우리)의 0xb62b4(타자, 22) 압도
    batterIntimidates: entryBatterIntimidatesAt(progress, progress.options.ourTeamId, progress.game.battingOrderIndex),
    ...pitcherSkillFlagsAt(progress, progress.options.opponentTeamId, progress.opponentPitcherIndex),
  })
}
