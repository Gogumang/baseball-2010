import { equipmentBonusOf } from '@/entities/career/model/equipment'

/**
 * **선수 레코드의 실효 능력치 `0xb6414(rec, k, 1)`** — 장비 니블 · 장착 스킬 단계 (G-1a 확정, 메인 b48dde5 · 37ce2e8):
 * ```
 * b6426  v = s16 rec[+0xc + 2k]
 * b6438  마선수(+0xa 비트 6)면 v = v · 0xd88aa[레벨] / 100   ; 리그·영입 선수는 건너뜀 — 마선수는 부르는 쪽이 먼저 먹인다
 * b648c  flag == 0 이면 끝
 * b6494  니블 n = rec[+0x19 + k/2] (k 짝수 윗니블) ≥ 1 → v = min(v + 0xd8890[n − 1], 999)
 * b64b0  스킬 5(+0x14 비트) → v = max(v − 100, 0)          ; 네 칸 모두
 * b64ca  스킬 7 → v = min(v + 50, 999)                     ; 네 칸 모두
 * b64e6  투수(0xb6278) ∧ 스킬 22 ∧ k == 0 → v += v / 10     ; 자르지 않는다
 * b6512  타자 ∧ 스킬 20 ∧ k == 2 → v = max(v − 100, 0)
 * ```
 * 나리 내 선수 `condition.equippedAbilityOf` · `pitcherCareer` 의 장비 보정, 시즌 카드 `equippedSeasonAbilityOf` 와 **같은 함수**다.
 * 경기용 능력치 `0xb570c` 는 맨 앞 b5728 에서 이 값(`0xb6415(rec, k, 1)`)을 받아 시즌·팀 보정을 더 먹인다 — 그래서 팀 경기
 * 명단(`TeamEntryBatter.ability`)·CPU 간이 경기(`quickBatterOf` · `quickPitcherOf`)의 밑값은 이 값이어야 한다.
 */

/** 능력치 상한 — 0xb6494 · 0xb64ca 의 `min 999` */
const ABILITY_LIMIT = 999
/** 장착 스킬 번호 (A 문서 · G-1a) */
const SKILL = { 무력감: 5, 전설: 7, 수비불가: 20, 냉정: 22 } as const
const PITCHER_CONTROL_SLOT = 0
const BATTER_DEFENSE_SLOT = 2

/** 레코드 칸 셋 — 능력치 +0xc · 장착 스킬 +0x14 · 장비 니블 +0x19/+0x1a */
export interface AbilityRecord {
  readonly ability: readonly number[]
  readonly skillBits: number
  readonly equipment: readonly number[]
}

const hasSkill = (skillBits: number, skill: number) => ((skillBits >>> skill) & 1) === 1

/** `0xb6414(rec, k, 1)` 한 칸 (마선수 배율 뒤) */
export function recordAbilityAt(record: AbilityRecord, slot: number, isPitcher: boolean): number {
  let value = record.ability[slot] ?? 0
  const nibble = record.equipment[slot] ?? 0
  if (nibble >= 1) value = Math.min(value + equipmentBonusOf(nibble), ABILITY_LIMIT)
  if (hasSkill(record.skillBits, SKILL.무력감)) value = Math.max(value - 100, 0)
  if (hasSkill(record.skillBits, SKILL.전설)) value = Math.min(value + 50, ABILITY_LIMIT)
  if (isPitcher && hasSkill(record.skillBits, SKILL.냉정) && slot === PITCHER_CONTROL_SLOT) value += Math.trunc(value / 10)
  if (!isPitcher && hasSkill(record.skillBits, SKILL.수비불가) && slot === BATTER_DEFENSE_SLOT) value = Math.max(value - 100, 0)
  return value
}

/** `0xb6414(rec, k, 1)` 네 칸 */
export function recordAbilityOf(record: AbilityRecord, isPitcher: boolean): [number, number, number, number] {
  return [0, 1, 2, 3].map((slot) => recordAbilityAt(record, slot, isPitcher)) as [number, number, number, number]
}
