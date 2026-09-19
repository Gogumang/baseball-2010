import data from '@/shared/config/original/data/balance.json'

/**
 * 원본 수치표 — 능력치·포인트·훈련·판정에 쓰는 숫자를 한곳에 모았다.
 * 값은 `data/balance.json` 에 있고 **그룹마다 `source` 로 binary.mod 주소를 적어 두었다.**
 * 근거가 없는 값은 `source` 에 "추정" 이라고 적는다 — 코드 주석이 아니라 데이터에 남긴다.
 *
 * 숫자를 고칠 일이 생기면 JSON 만 고치면 된다. 여기는 타입만 입힌다.
 */
export interface IntegerRange {
  readonly minimum: number
  readonly maximumExclusive: number
}

export interface AbilityValues {
  readonly hit: number
  readonly power: number
  readonly defense: number
  readonly run: number
}

interface SwingFormula {
  readonly hitBase: number
  readonly hitCoefficient: number
  readonly extraBase: number
  readonly extraCoefficient: number
  readonly contactFactor: number
}

interface Balance {
  readonly ability: {
    readonly maximum: number
    readonly rookieByBattingType: readonly AbilityValues[]
    readonly rookiePositionBonus: number
  }
  readonly rookie: {
    readonly popularity: number
    readonly reputation: number
    readonly morale: number
    readonly salary: number
    readonly money: number
    readonly gamePoint: number
    readonly skillIds: readonly number[]
  }
  readonly limits: {
    readonly morale: number
    readonly popularity: number
    readonly reputation: number
    readonly affection: number
    readonly gamePoint: number
    readonly moneyUnits: number
    readonly nameBytes: number
  }
  readonly money: { readonly unit: number }
  readonly season: {
    readonly gamesPerSeason: number
    readonly gamesPerManagementCycle: number
  }
  readonly training: {
    readonly gainRange: IntegerRange
    readonly legGainRange: IntegerRange
    readonly moraleLossRange: IntegerRange
    readonly typeBonus: number
    readonly rookieSkillId: number
    readonly weakBodySkillId: number
  }
  readonly specialSwing: {
    readonly requiredSessions: readonly number[]
    readonly gamePointCost: readonly number[]
    readonly moraleLossRange: IntegerRange
  }
  readonly recordGamePoints: readonly number[]
  readonly swing: {
    readonly aceFormula: SwingFormula
    readonly normalFormula: SwingFormula
    readonly hitWeight: number
    readonly extraWeight: number
    readonly powerPivot: number
    readonly foulPercent: number
    readonly outPercent: number
    readonly aceBonus: {
      readonly batterBase: number
      readonly batterPerLevel: number
      readonly pitcherBase: number
      readonly pitcherPerLevel: number
    }
    readonly missionAcePitcherBonus: number
    readonly pitchGradeMultipliers: readonly number[]
    readonly solidCap: number
    readonly homeRunCap: number
    readonly swingStrengthBonus: number
    readonly exhaustedBonus: number
  }
  readonly quickAtBat: {
    readonly basePower: number
    readonly spreadRange: IntegerRange
    readonly weakSwingGate: number
    readonly tightCourseGate: number
    readonly tightCourseGain: number
    readonly extraBaseLimit: number
    readonly extraInningFrom: number
    readonly extraInningPowerStep: number
    readonly extraInningPowerFloor: number
    readonly powerScale: { readonly minimum: number; readonly maximumValue: number }
    readonly pitchGradeTable: readonly (readonly number[])[]
    readonly pitchGradeBand: number
  }
  readonly coldGame: { readonly fromInning: number; readonly margin: number }
}

// JSON 은 고정 길이 배열·리터럴 타입을 나타내지 못해 한 번 단언한다
export const BALANCE = data as unknown as Balance
