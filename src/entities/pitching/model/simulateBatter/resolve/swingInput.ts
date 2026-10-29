import { pitcherBoostSideOf, swingBoostOf, timingOf } from '@/entities/pitching/model/simulateBatter/otherSlices'
import type { BatterAbility, SwingResultInput, SwingSituation } from '@/entities/pitching/model/simulateBatter/otherSlices'
import type { CpuSwingPlan } from '@/entities/pitching/model/simulateBatter/resolve/swingPlan'
import type { BatterSituation, CpuBatterTraits, PitcherStats } from '@/entities/pitching/model/simulateBatter/types'
import type { Pitch } from '@/entities/pitching/model/pitch'
import { pitcherHandOfPitch } from '@/entities/pitching/model/pitcherHand'

/** 웹 존 좌표 1 = 존 반폭 16.5px — 0xab214 는 원본 픽셀 오차를 받는다 */
const ZONE_HALF_PIXELS = 16.5
/** 스킬 상황을 안 넘긴 부르는 쪽 — 1회 · 이기는 중 · 주자 없음 · 빈 링 · 칸 0 */
const NEUTRAL_SITUATION: SwingSituation = {
  inning: 1,
  isLosing: false,
  runnerCount: 0,
  hasSecondBaseRunner: false,
  pitcherSide: 0,
  batterSide: 0,
  balls: 0,
  strikes: 0,
  batterOrderIndex: 0,
  recentAtBatCodes: [],
}

/** 0x34d6c — 타자 쪽은 S+0x10, 투수 쪽은 공+0x10 (사람 투수 공에 마구가 실렸을 때만) */
function cpuSwingBoostOf(pitch: Pitch, traits: CpuBatterTraits, specialNumber: number) {
  const special = traits.specialSwing
  return swingBoostOf(
    {
      number: specialNumber,
      // 일반 CPU 타자는 S+0x10 을 쓰지 않으므로(0x34488 만 쓴다) 필살 번호가 있으면 마타자다
      isAce: true,
      aceOrder: special?.aceOrder ?? 0,
      aceLevel: special?.aceLevel ?? 0,
      isOwnPlayer: false,
    },
    pitcherBoostSideOf(pitch.magicNumber ?? 0, pitch.pitcherMagicNumber ?? 0, () => traits.pitcherAceLevel ?? 0),
  )
}

/**
 * 0xab214 는 투수·타자 레코드로 손(0xb63c0)·칸(0xb6394)을 바로 읽는다. 투수 손은 공에 실린 폼·+0x18 로,
 * 타자 손은 화면 배치(`stageSide` = 0x3b084 의 0xb63c1(타자))로 둔다. 볼카운트는 state+4·+5(이 공 앞)
 */
function cpuSwingSituationOf(pitch: Pitch, situation: BatterSituation, traits: CpuBatterTraits): SwingSituation {
  return {
    ...NEUTRAL_SITUATION,
    ...traits.skillSituation,
    balls: situation.balls,
    strikes: situation.strikes,
    pitcherSide: pitcherHandOfPitch(pitch),
    batterSide: pitch.stageSide,
  }
}

/** CPU 타자 스윙이 0xab214(`swingResultOf`)에 넘기는 입력 한 벌 (0x51294) — 난수를 쓰지 않는다 */
export function cpuSwingInputOf(
  pitch: Pitch,
  batter: BatterAbility,
  pitcher: PitcherStats,
  situation: BatterSituation,
  traits: CpuBatterTraits,
  plan: CpuSwingPlan,
): SwingResultInput {
  const boost = cpuSwingBoostOf(pitch, traits, plan.specialNumber)
  return {
    horizontalError: Math.round(pitch.plate.x * ZONE_HALF_PIXELS),
    verticalError: -Math.round(pitch.plate.y * ZONE_HALF_PIXELS) || 0,
    timing: timingOf(plan.frame, pitch.frameCount, false),
    buntKind: plan.buntKind,
    controlTier: pitch.controlTier,
    batter,
    pitcher,
    mode: traits.swingMode ?? '일반',
    isPitcherOwnPlayer: traits.isPitcherOwnPlayer,
    careerYearIndex: traits.careerYearIndex,
    // 사람이 던지고 CPU 가 치는 타석 — 모드를 넘겨받았을 때만 팀 조작 보정을 싣는다
    isOffenseHuman: false,
    isDefenseHuman: traits.swingMode !== undefined,
    boost,
    // ab838 — 투수 체력% 0 이면 B · C 에 +2000
    isPitcherExhausted: traits.pitcherStaminaPercent === 0,
    // 0xab214 ab91c~ — 두 레코드 +0x14 를 `0xb62b4` 로 읽는다(모드 검사 없음). CPU 타자 · 사람 투수 둘 다 부르는 쪽이 싣는다
    batterSkillIds: traits.batterSkillIds ?? [],
    pitcherSkillIds: traits.pitcherSkillIds ?? [],
    situation: cpuSwingSituationOf(pitch, situation, traits),
  }
}
