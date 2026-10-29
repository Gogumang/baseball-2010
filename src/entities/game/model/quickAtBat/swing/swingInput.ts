import { runnerCountOf } from '@/entities/game/model/baseState'
import type { BaseState } from '@/entities/game/model/baseState'
import type { SwingResultInput } from '@/entities/game/model/quickAtBat/otherSlices'
import type { QuickPitch } from '@/entities/game/model/quickAtBat/pitch/quickPitch'
import { quickSwingBoostOf } from '@/entities/game/model/quickAtBat/swing/swingBoost'
import type { PitcherStats, QuickAtBatBatter, QuickAtBatPitcher, QuickAtBatSituation } from '@/entities/game/model/quickAtBat/types'

/** 공 하나를 던질 때의 볼카운트 st[4]·st[5] 와 주자 목록(sim+0x80) — 0xab214 스킬 상황 칸이 본다 */
export interface PitchMoment {
  readonly strikes: number
  readonly balls: number
  readonly bases: BaseState
}

/** 이 공의 코스 · 구위 등급과, 0xab214 투수 쪽(ab548)이 읽는 체력% 능력 */
export interface SwingPitch {
  readonly pitch: QuickPitch
  readonly controlTier: number
  readonly tired: PitcherStats
}

/** 0xab214 스킬 상황 칸 */
function swingSituationOf(
  batter: QuickAtBatBatter,
  pitcher: QuickAtBatPitcher,
  situation: QuickAtBatSituation,
  moment: PitchMoment,
): SwingResultInput['situation'] {
  return {
    inning: situation.inning,
    isLosing: situation.isLosing === true,
    // ab9c2 0xa9889(주자 목록) · abd06 0xa97a0(주자 목록, 2) — 간이 엔진의 주자 목록 sim+0x80 = 이 공의 루
    runnerCount: runnerCountOf(moment.bases),
    hasSecondBaseRunner: moment.bases.second,
    // 0xab214 는 두 레코드로 손 0xb63c0(0xab9f0·0xaba1e·0xabc50)·칸 0xb6394(0xabcd8)를 바로 읽는다
    pitcherSide: pitcher.hand ?? 0,
    batterSide: batter.hand ?? 0,
    // st[5]·st[4] — 이 공을 던지기 앞의 카운트
    balls: moment.balls,
    strikes: moment.strikes,
    batterOrderIndex: batter.recordSlot ?? 0,
    recentAtBatCodes: situation.recentAtBatCodes ?? [],
  }
}

/** 간이 타석이 0xab214(`swingResultOf`)에 넘기는 입력 한 벌 (0xc11f0 c14e4) — 난수를 쓰지 않는다 */
export function quickSwingInputOf(
  batter: QuickAtBatBatter,
  pitcher: QuickAtBatPitcher,
  situation: QuickAtBatSituation,
  { pitch, controlTier, tired }: SwingPitch,
  moment: PitchMoment,
): SwingResultInput {
  return {
    horizontalError: pitch.spreadX,
    verticalError: pitch.spreadY,
    timing: pitch.power,
    buntKind: 0,
    controlTier,
    batter,
    pitcher: tired,
    boost: quickSwingBoostOf(batter, pitcher),
    mode: situation.mode ?? '일반',
    // 0xab214 는 두 레코드의 비트7(0xb6389)을 직접 읽는다 — 간이 타석도 같다
    ...(batter.isOwnPlayer === true ? { isBatterOwnPlayer: true } : {}),
    ...(pitcher.isOwnPlayer === true ? { isPitcherOwnPlayer: true } : {}),
    ...(situation.careerYearIndex === undefined ? {} : { careerYearIndex: situation.careerYearIndex }),
    ...(situation.isOffenseHuman === true ? { isOffenseHuman: true } : {}),
    ...(situation.isDefenseHuman === true ? { isDefenseHuman: true } : {}),
    isPitcherExhausted: pitcher.stamina === 0,
    batterSkillIds: batter.skillIds,
    pitcherSkillIds: pitcher.skillIds,
    situation: swingSituationOf(batter, pitcher, situation, moment),
  }
}
