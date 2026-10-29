/** 0xd 진입의 타자 비트 0x445cc · 투수 비트 0x3d160 — 장착 스킬 가운데 지금 경기 상황에 걸리는 것 */

/** 홈런더비(모드 7)는 0x445cc · 0x3d160 이 비트를 0 으로만 둔다 (445e0 · 3d176) */
const HOME_RUN_DERBY_MODE = 7

/** 이닝 칸 st[0x6b] > 4 (0부터) = 6회 이후 */
const LATE_INNING_FROM = 6

/** 0xd · 0xf 진입에 비트를 정할 때 보는 경기 상황 */
export interface SkillPanelSituation {
  /** 전역 게임 모드 (0x1552d10) */
  readonly gameMode?: number
  /** 1부터 센 이닝 (st[0x6b] + 1) */
  readonly inning: number
  /** 0xb69b0 — 공격 측 · 수비 측 점수 */
  readonly attackScore: number
  readonly defenseScore: number
  /**
   * 0xa9888 — 주자관리(장면 +0x20c) 루 0~3 의 산 주자 수. 0xd 진입 때 루 0(타자)은 비어 있다 — 타자주자는 0x17 진입 0x46418 의
   * 4650e 0xa93ac 가 처음 넣고, 파울은 0x35108 의 0xa975c 가 개수를 되돌리며, 3아웃은 0x18 진입 0x3ac90 이 목록을 비운다 → 1~3루 주자 수
   */
  readonly runnerCount: number
  /** 0xa97a0(필드, 2) */
  readonly hasSecondBaseRunner: boolean
  /** 0xb63c0(투수) · 0xb63c0(타자) — 0 오른손 · 1 왼손 */
  readonly pitcherHand: number
  readonly batterHand: number
  /** 0xb6394(타자) = rec[0xa] & 0x1f */
  readonly batterRecordSlot: number
  /** 타순 칸 기록 링(앞이 오래된 것) — 0x53100 */
  readonly recentAtBatCodes: readonly number[]
}

export const has = (bits: number, bit: number) => ((bits >>> bit) & 1) === 1

const isLateInning = (situation: SkillPanelSituation) => situation.inning >= LATE_INNING_FROM

/** 0x53100(링, 0) · (링, 1) 이 모두 [low, high] 이고 개수 > minimum (0x445cc 4478c~447f2 · 447f4~4485c) */
function streakOf(codes: readonly number[], minimum: number, low: number, high: number): boolean {
  if (codes.length <= minimum) return false
  return codes.slice(0, 2).every((code) => code >= low && code <= high)
}

/**
 * **타자 비트 `0x445cc`** — 0xb62b4(지금 타자, n) 이 서 있고 조건이 맞는 것만 (445d6 에서 먼저 0).
 * 1 · 2 · 5 · 7 · 8 · 9 · 11 · 12 · 18~23 은 조건 없음 · 10 해결사 = 6회 이후 지고 있음 · 13 좌완UP = 투수 왼손 · 14 우완UP = 투수 오른손 ·
 * 16 상승세 = 링 > 3 이고 맨 앞 둘이 1~4 · 17 하락세 = 링 > 2 이고 둘이 5~7. 0·3·4·6·15 는 안 본다.
 */
export function batterSkillPanelBitsOf(skillBits: number, situation: SkillPanelSituation): number {
  if (situation.gameMode === HOME_RUN_DERBY_MODE) return 0
  const conditions: Readonly<Record<number, boolean>> = {
    10: isLateInning(situation) && situation.defenseScore > situation.attackScore,
    13: situation.pitcherHand !== 0,
    14: situation.pitcherHand === 0,
    16: streakOf(situation.recentAtBatCodes, 3, 1, 4),
    17: streakOf(situation.recentAtBatCodes, 2, 5, 7),
  }
  const bits = [1, 2, 5, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20, 21, 22, 23]
  return bits.reduce((sum, bit) => (has(skillBits, bit) && (conditions[bit] ?? true) ? sum | (1 << bit) : sum), 0)
}

/**
 * **투수 비트 `0x3d160`** — 0xb62b4(수비 투수, n) (투수 스킬 번호는 비트 + 16 — 비트 0~7 은 공통 스킬).
 * 1 · 2 · 5 · 7 · 8 · 9 · 10 · 18 · 19 · 20 · 22 는 조건 없음 · 12 좌타UP = 타자 왼손 · 13 우타UP = 타자 오른손 · 14 투지 = 6회 이후 수비가 짐 ·
 * 15 집중 = 타자 칸 0xb6394 가 2~4 · 16 안정감 = 주자 > 1 · 17 새가슴 = 2루 주자 · 21 열혈 = 주자 > 0. 0·3·4·6·11·23 은 안 본다
 * (11 은 0xf 진입의 2 스트라이크 갈래 — `TWO_STRIKE_PITCHER_BITS`).
 * 주자 수 0xa9888 은 0xd 진입 때 1~3루 주자만 센다(`SkillPanelSituation.runnerCount`).
 */
export function pitcherSkillPanelBitsOf(skillBits: number, situation: SkillPanelSituation): number {
  if (situation.gameMode === HOME_RUN_DERBY_MODE) return 0
  const conditions: Readonly<Record<number, boolean>> = {
    12: situation.batterHand !== 0,
    13: situation.batterHand === 0,
    14: isLateInning(situation) && situation.defenseScore < situation.attackScore,
    15: situation.batterRecordSlot > 1 && situation.batterRecordSlot <= 4,
    16: situation.runnerCount > 1,
    17: situation.hasSecondBaseRunner,
    21: situation.runnerCount > 0,
  }
  const bits = [1, 2, 5, 7, 8, 9, 10, 12, 13, 14, 15, 16, 17, 21, 18, 19, 20, 22]
  return bits.reduce((sum, bit) => (has(skillBits, bit) && (conditions[bit] ?? true) ? sum | (1 << bit) : sum), 0)
}

/** 스킬 번호 → 레코드 +0x14 비트 (타자는 그대로, 투수는 번호 − 16 — `skillIdsOfBits` 의 거꾸로) */
export function skillBitsOfIds(ids: readonly number[], isPitcher: boolean): number {
  return ids.reduce((bits, id) => {
    const bit = isPitcher ? id - 16 : id
    return bit >= 0 && bit < 32 ? bits | (1 << bit) : bits
  }, 0)
}
