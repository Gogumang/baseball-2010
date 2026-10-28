import { BALANCE } from '@/shared/config/original/balance'
import { D_LEVEL } from '@/shared/config/original/dLevel'

/**
 * **숨은 판정값의 원본 값** — `balance.json` 의 기본값이 이 값과 같아야 한다 (`balance.test.ts` 가 하나씩 견준다).
 *
 * d_level.dat 에서 생성기가 읽은 값(`D_LEVEL` · `BALANCE`)은 그대로 가져오고, 함수 리터럴은 이식 때 디스어셈에서 옮긴 값을 적는다.
 * 근거 주소는 `balance.json` 항목의 `source` 에 있다. 여기 값을 바꾸면 "원본" 이 바뀌는 것이니 고치지 않는다 —
 * 손볼 값은 `balance.json` 쪽이다.
 */
export const ORIGINAL_BALANCE_NUMBERS = {
  // ── 타이밍 0x34be0 · 스윙 창 0x4e1e4
  'timing.width': 24,
  'timing.specialWidth': 22,
  'timing.specialDivisor': 12,
  'timing.floor': D_LEVEL.swingTiming.floor,
  'timing.scale': D_LEVEL.swingTiming.scale,
  'timing.reachDepth': 3000,
  // ── 스윙 결과 0xab214
  'swing.ownBatterBonusBase': D_LEVEL.swing.aceBonus.batterBase,
  'swing.ownBatterBonusPerYear': D_LEVEL.swing.aceBonus.batterPerLevel,
  'swing.ownPitcherBonusBase': D_LEVEL.swing.aceBonus.pitcherBase,
  'swing.ownPitcherBonusPerYear': D_LEVEL.swing.aceBonus.pitcherPerLevel,
  'swing.missionOwnPitcherBonus': BALANCE.swing.missionAcePitcherBonus,
  'swing.contactBase': 1200,
  'swing.normalContactFactor': D_LEVEL.swing.normalFormula.contactFactor,
  'swing.aceContactFactor': D_LEVEL.swing.aceFormula.contactFactor,
  'swing.normalHitBase': D_LEVEL.swing.normalFormula.hitBase,
  'swing.normalHitCoefficient': D_LEVEL.swing.normalFormula.hitCoefficient,
  'swing.normalExtraBase': D_LEVEL.swing.normalFormula.extraBase,
  'swing.normalExtraCoefficient': D_LEVEL.swing.normalFormula.extraCoefficient,
  'swing.aceHitBase': D_LEVEL.swing.aceFormula.hitBase,
  'swing.aceHitCoefficient': D_LEVEL.swing.aceFormula.hitCoefficient,
  'swing.aceExtraBase': D_LEVEL.swing.aceFormula.extraBase,
  'swing.aceExtraCoefficient': D_LEVEL.swing.aceFormula.extraCoefficient,
  'swing.hitWeight': D_LEVEL.swing.hitWeight,
  'swing.extraWeight': D_LEVEL.swing.extraWeight,
  'swing.timingPivot': D_LEVEL.swing.powerPivot,
  'swing.foulPercent': D_LEVEL.swing.foulPercent,
  'swing.outPercent': D_LEVEL.swing.outPercent,
  'swing.solidCap': BALANCE.swing.solidCap,
  'swing.homeRunCap': BALANCE.swing.homeRunCap,
  'swing.swingStrengthBonus': BALANCE.swing.swingStrengthBonus,
  'swing.exhaustedBonus': BALANCE.swing.exhaustedBonus,
  'swing.lineDriveFactor': 120,
  'swing.teamHumanDefensePenalty': 10,
  'swing.batterMissionHumanBonus': 100,
  // ── 실효 능력치 0xb570c · 0xb6414
  'ability.illnessCutPercent': 30,
  'ability.injuryCutPercent': 60,
  'ability.skillPenalty': 100,
  'ability.legendSkillBonus': 50,
  // ── 투구
  'pitching.controlRowWidth': 250,
  'pitching.mistakeBase': 8,
  'pitching.unpressedMistakePercent': 20,
  'pitching.wildPitchPermyriad': D_LEVEL.wildPitchChance,
  // ── 수비
  'fielding.throwErrorBase': 100,
  'fielding.throwSpeedBase': D_LEVEL.fielding.throwSpeedBase,
  'fielding.throwSpeedPerGrade': D_LEVEL.fielding.throwSpeedPerGrade,
  // ── 주루
  'running.baseSpeed': D_LEVEL.runnerLeadBase,
  'running.speedPerRun': 7,
} as const satisfies Record<string, number>

export const ORIGINAL_BALANCE_LISTS = {
  'swing.pitchGradeMultipliers': D_LEVEL.swing.pitchGradeMultipliers,
  'swing.centerFactors': [10_000, 500, 350],
  'swing.buntSuccessPercent': [0, 75, 50, 50],
  'ability.equipmentBonus': [30, 50, 70, 90, 110, 125, 140, 190, 210, 230, 250],
  'pitching.controlErrorCoefficients': [12, 20, 25, 30],
  'pitching.aimHalfWidths': [21, 20, 18, 16, 14, 12, 10, 8, 6],
  'pitching.mistakeAbilityPercent': [70, 80, 90, 100, 105, 110],
  'pitching.mistakeGradeBonus': [10, 5, 0, 0, -1, -2],
  'pitching.fatigueThresholds': [55, 35, 20, 1],
  'pitching.fatigueCutPercents': [0, 10, 30, 50, 90],
  'fielding.fumblePermyriad': [200, 180, 160, 140, 120, 100, 80, 50],
  'fielding.specialDefensePercent': [1, 2, 3, 3, 4, 4, 5, 6],
} as const satisfies Record<string, readonly number[]>

export const ORIGINAL_BALANCE_GRIDS = {
  'swing.errorBands': [
    [22, 0, -1000, -2000],
    [19, 3000, -500, -1000],
    [15, 6000, -300, -400],
    [12, 8500, -125, -100],
    [9, 9000, -50, -50],
    [3, 9500, 0, 0],
  ],
  /** 스킬 8 · 9 · 10 · 12 · 13 · 14 · 15 · 16 · 17 · 18 · 19 차례 — [B %, C %] */
  'skill.batterSwingPercents': [
    [1, 1],
    [2, 0],
    [3, 3],
    [0, 5],
    [2, 0],
    [2, 0],
    [3, 0],
    [5, 5],
    [-10, -10],
    [-10, 0],
    [1, -10],
  ],
  /** 스킬 24 · 25 · 27 · 28 · 29 · 31 · 33 · 35 · 37 차례 — [B %, C %] */
  'skill.pitcherSwingPercents': [
    [-1, -1],
    [-2, 0],
    [-3, 0],
    [-2, 0],
    [-2, 0],
    [0, -10],
    [-5, 0],
    [5, 0],
    [-2, -2],
  ],
  'ability.moraleCuts': [
    [10, 50],
    [30, 20],
    [50, 10],
  ],
  'pitching.controlTierRows': BALANCE.quickAtBat.pitchGradeTable,
  'pitching.controlErrorRows': [
    [10, 35, 80, 100],
    [40, 65, 90, 100],
    [50, 73, 93, 100],
    [60, 80, 95, 100],
    [72, 87, 97, 100],
    [84, 94, 99, 100],
  ],
} as const satisfies Record<string, readonly (readonly number[])[]>

export type BalanceNumberId = keyof typeof ORIGINAL_BALANCE_NUMBERS
export type BalanceListId = keyof typeof ORIGINAL_BALANCE_LISTS
export type BalanceGridId = keyof typeof ORIGINAL_BALANCE_GRIDS
export type BalanceId = BalanceNumberId | BalanceListId | BalanceGridId

export type BalanceValue = number | readonly number[] | readonly (readonly number[])[]
export type BalanceValues = Readonly<Record<BalanceId, BalanceValue>>

export const ORIGINAL_BALANCE_VALUES: BalanceValues = {
  ...ORIGINAL_BALANCE_NUMBERS,
  ...ORIGINAL_BALANCE_LISTS,
  ...ORIGINAL_BALANCE_GRIDS,
}
