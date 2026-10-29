import { swingResultOf } from '@/entities/batting/model/swingResult'
import { timingOf } from '@/entities/batting/model/swingTiming'
import type { Pitch, PitcherAbility } from '@/entities/pitching/model/pitch'
import { cpuPitchStatsOf } from '@/entities/pitching/model/pitcherGameStats'
import { skillIdsOfBits } from '@/entities/team/model/teamRoster'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { plateErrorOf } from '@/features/play-at-bat/model/resolvePitch/plateJudgement'
import type { BattingContext, BattingSwing } from '@/features/play-at-bat/model/resolvePitch/types'

/**
 * 던지는 투수의 0xab214 스킬 번호 — 마투수처럼 번호를 직접 든 능력치(`PitcherAbility.skillIds`, `aceSkillIdsOf`)면 그것,
 * 아니면 레코드 +0x14 비트(`skillBits`)를 투수 번호(비트 + 16)로
 */
function pitcherSkillIdsOf(pitcher: PitcherAbility): readonly number[] {
  return pitcher.skillIds ?? skillIdsOfBits(pitcher.skillBits ?? 0, true)
}

/** 투수 체력%는 공에 실린 **깎은 뒤** 값이다 — 원본은 공이 손을 떠나는 0x11 진입(0x3dec6 → 0xa5e14)에서 이미 깎았다 */
function pitcherAtReleaseOf(pitch: Pitch, pitcher: PitcherAbility): PitcherAbility {
  return pitch.pitcherStaminaPercent === undefined ? pitcher : { ...pitcher, staminaPercent: pitch.pitcherStaminaPercent }
}

/** **사람 타자의 스윙 판정 0xab214** — 판정 오차(0x51226) · 타이밍 · 투수 경기 능력치를 모아 굴린다 */
export function rollSwingResult(pitch: Pitch, swing: BattingSwing, context: BattingContext, random: RandomPort): ReturnType<typeof swingResultOf> {
  const error = plateErrorOf(pitch, swing.shift)
  const pitcherStats = cpuPitchStatsOf(pitcherAtReleaseOf(pitch, context.pitcher))
  return swingResultOf(
    {
      horizontalError: error.horizontal,
      verticalError: error.vertical,
      timing: timingOf(swing.frame, pitch.frameCount, pitch.isMagicPitch === true),
      buntKind: swing.buntKind,
      controlTier: pitch.controlTier,
      batter: context.batter,
      // ab548(구속 k=1)·ab582(제구 k=0) 가 0xb570c 를 스택 인자 [sp+0xc8] = 투수 체력%로 부른다 (P7 G1) —
      // 투구 AI 와 같은 피로·팀·코치 차례다. 원본 재료(`gameAbility`)가 없으면 옛 경계(×10, 피로 없음) 그대로
      pitcher: { control: pitcherStats.control, velocity: pitcherStats.velocity },
      mode: context.mode,
      isBatterOwnPlayer: context.isBatterOwnPlayer,
      isPitcherOwnPlayer: context.isPitcherOwnPlayer,
      careerYearIndex: context.careerYearIndex,
      // 이 판정은 사람이 치는 타석이다 — 공격 팀 사람, 수비 팀 CPU (0xb6c20)
      isOffenseHuman: true,
      isDefenseHuman: false,
      boost: context.swingBoost,
      // ab838 `[sp+0xc8] == 0` 이면 B·C 에 2000 (같은 체력% 인자)
      isPitcherExhausted: !pitcherStats.isNotExhausted,
      batterSkillIds: context.batterSkillIds,
      // 0xab214 ab91c~ — 수비 투수 레코드 +0x14 도 `0xb62b4(투수, n)` 로 읽는다(모드 검사 없음, 번호 = 비트 + 16)
      pitcherSkillIds: pitcherSkillIdsOf(context.pitcher),
      situation: context.situation,
    },
    random,
  )
}
