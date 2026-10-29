import { FULL_STAMINA, PITCHER_ABILITY_ORDER, type BatterAbility, type PitcherAbility } from '@/entities/collection/model/collection/otherSlices'
import {
  HALL_OF_FAME_MAX_BATTERS,
  HALL_OF_FAME_MAX_PITCHERS,
  hallOfFameBatterAt,
  hallOfFamePitcherAt,
  hallOfFameSlotOfRecordId,
} from '@/entities/collection/model/collection/hallOfFame/slots'
import type { Collection, HallOfFamePitcher, HallOfFameSide, HallOfFamer } from '@/entities/collection/model/collection/types'

/** 명전 기록 시즌 줄 +0x20~+0x2b 여섯 칸이 모두 0 — 시즌 영입 0xc554 의 0xb6cc4 · 0xb8e28 이 지운 줄 */
const CLEARED_RECORD_LINE: readonly number[] = [0, 0, 0, 0, 0, 0]
const isClearedLine = (line: readonly number[] | undefined) =>
  line !== undefined && line.length === CLEARED_RECORD_LINE.length && line.every((value) => value === 0)

/** 장비 니블 차례 t → 능력치 칸 (타자 0x897e8 의 부위 차례 · 투수 `PITCHER_ABILITY_ORDER`) */
const BATTER_EQUIPMENT_KEYS: readonly (keyof BatterAbility)[] = ['hit', 'power', 'defense', 'run']

/**
 * 명전 기록의 장비 니블 네 칸 (+0x19 윗·아랫니블 · +0x1a 윗·아랫니블) — 시즌에 영입한 명예 선수의 팀 레코드 줄은 영입 0xc554 가
 * 이 0x30 바이트를 통째로 옮긴 사본이라 처음 니블이 이것이다. 칸이 없거나 옛 기록(니블 칸 없음)이면 null.
 */
export function hallOfFameEquipmentNibblesOf(
  collection: Pick<Collection, 'hallOfFame' | 'hallOfFamePitchers'>,
  side: HallOfFameSide,
  recordId: number,
): readonly number[] | null {
  const slot = hallOfFameSlotOfRecordId(side, recordId)
  if (side === '투수') {
    const levels = hallOfFamePitcherAt(collection, slot)?.equipmentLevels
    return levels === undefined ? null : PITCHER_ABILITY_ORDER.map((key) => levels[key])
  }
  const levels = hallOfFameBatterAt(collection, slot)?.equipmentLevels
  return levels === undefined ? null : BATTER_EQUIPMENT_KEYS.map((key) => levels[key])
}

/**
 * **0x2328c(저장, 줄, 투수?)** — 시즌 장비 창 0xdc 의 적용 0x7d90 이 명예 선수(0xb6348)의 장비를 산 뒤 부른다(0x7ef4~0x7f12).
 * ```
 * 투수? ≠ 0: i = 0..3  0x1f62c(저장, i) (명전 투수 칸) 의 +0 == 줄+0 이면 +0x19 · +0x1a 를 줄의 것으로 · 저장 0x1f1b8
 * 투수? = 0: i = 0..7  0x1f640(저장, i) (명전 타자 칸) 같은 식
 * ```
 * 니블 두 바이트를 통째로 옮기므로 네 부위가 모두 줄의 값이 된다. 칸 +0 은 등록이 칸 + 0xb4 / + 0xc8 로 덮어쓴 번호라
 * 번호에서 칸을 되찾는다(빈 칸은 +0 = 0 이라 맞지 않는다). 맞는 칸이 없으면 같은 객체.
 */
export function syncHallOfFameEquipment(collection: Collection, side: HallOfFameSide, recordId: number, nibbles: readonly number[]): Collection {
  const slot = hallOfFameSlotOfRecordId(side, recordId)
  const nibbleAt = (part: number) => nibbles[part] ?? 0
  if (side === '투수') return syncPitcherEquipment(collection, slot, nibbleAt)
  if (slot < 0 || slot >= HALL_OF_FAME_MAX_BATTERS || hallOfFameBatterAt(collection, slot) === null) return collection
  const equipmentLevels: BatterAbility = { hit: nibbleAt(0), power: nibbleAt(1), defense: nibbleAt(2), run: nibbleAt(3) }
  return {
    ...collection,
    hallOfFame: collection.hallOfFame.map((famer, index) => ((famer.slot ?? index) === slot ? { ...famer, equipmentLevels } : famer)),
  }
}

function syncPitcherEquipment(collection: Collection, slot: number, nibbleAt: (part: number) => number): Collection {
  if (slot < 0 || slot >= HALL_OF_FAME_MAX_PITCHERS || hallOfFamePitcherAt(collection, slot) === null) return collection
  // 니블 t ↔ `PITCHER_ABILITY_ORDER[t]` (제구·구속·변화·체력)
  const equipmentLevels: PitcherAbility = {
    control: nibbleAt(0),
    velocity: nibbleAt(1),
    breaking: nibbleAt(2),
    stamina: nibbleAt(3),
  }
  return {
    ...collection,
    hallOfFamePitchers: collection.hallOfFamePitchers.map((famer) => (famer.slot === slot ? { ...famer, equipmentLevels } : famer)),
  }
}

/** 기록 +0xa 아랫 5비트 마스크 — `0xb6605` 의 `(+0xa & 0xe0) | (j & 0x1f)` */
const RECORD_SLOT_MASK = 0x1f

/** 명전 기록의 +0xa 아랫 5비트 (`HallOfFameRecordFields.recordSlot`, 없으면 등록이 적은 0) */
export function hallOfFameRecordSlotOf(famer: HallOfFamer | HallOfFamePitcher): number {
  return (famer.recordSlot ?? 0) & RECORD_SLOT_MASK
}

/**
 * **시즌 영입 0xc554 의 원본 기록 칸 고치기** — c536~c550 이 명전 칸 `0x1f62d(투수) / 0x1f641(타자)(앱, [목록+0x130])` 을 받고
 * c578 `0xb6605(그 기록, j)` 가 +0xa 아랫 5비트를 고른 자리 j 로 (윗 3비트는 둔다). 이어서 **같은 기록**(r4)에 (r278 직접 떴다):
 * ```
 * 투수 c584  strh 0x2710, [r4, #0x2c]  ; c58c 0xb6cc5(r4): +0x20~+0x2b · +0x2e · +0x2f = 0, +0x2c = 0x2710
 * 타자 c5ae  0xb8e29(r4)                ; +0x20~+0x2f = 0
 * ```
 * 그래서 영입한 명전 기록의 시즌 줄(`recordLine`)은 0 이 되고 투수 +0x2c(`stamina`)는 10000 이다. 그 뒤 0xc5dc `0x22755(앱, 1)` → 22bee
 * `0x1f1b8` 이 전역 블록을 game_o.sav 에 쓴다 — 명전 기록은 그 블록 안이라 저장된다. 칸은 기록 번호(칸 + 0xb4 / + 0xc8)로 찾는다.
 * 나리 칸(0 · 5)은 `0x22169 / 0x220ed` 가 `0x213c0(앱, 3|4, 1)` 로 올린 나리 저장의 기록을 고치나, 0x22755 는 지금 모드
 * ([앱+0x40], 시즌) 파일과 전역 블록만 쓰고 0xc5fa~0xc608 `0x1f24d(앱, 4) · (앱, 3)` 가 그 저장을 쓰지 않고 풀어(0x1f3c6 ·
 * 0x1f4e6) 파일에 안 남는다 — 그래서 여기는 명전 칸만 받는다. 없는 칸이면 같은 객체.
 */
export function withHallOfFameRecordSlot(collection: Collection, side: HallOfFameSide, recordId: number, recordSlot: number): Collection {
  const slot = hallOfFameSlotOfRecordId(side, recordId)
  const value = recordSlot & RECORD_SLOT_MASK
  if (side === '투수') return withPitcherRecordSlot(collection, slot, value)
  const famer = slot < 0 || slot >= HALL_OF_FAME_MAX_BATTERS ? null : hallOfFameBatterAt(collection, slot)
  if (famer === null || (famer.recordSlot === value && isClearedLine(famer.recordLine))) return collection
  const recruited = { ...famer, recordSlot: value, recordLine: CLEARED_RECORD_LINE }
  return {
    ...collection,
    hallOfFame: collection.hallOfFame.map((entry, index) => ((entry.slot ?? index) === slot ? recruited : entry)),
  }
}

/** 투수 칸 — 시즌 줄을 지우고(0xb6cc4) +0x2c 를 10000 으로(c584) */
function withPitcherRecordSlot(collection: Collection, slot: number, value: number): Collection {
  const famer = slot < 0 || slot >= HALL_OF_FAME_MAX_PITCHERS ? null : hallOfFamePitcherAt(collection, slot)
  if (famer === null || isRecruitedPitcher(famer, value)) return collection
  const recruited = { ...famer, recordSlot: value, recordLine: CLEARED_RECORD_LINE, stamina: FULL_STAMINA }
  return {
    ...collection,
    hallOfFamePitchers: collection.hallOfFamePitchers.map((entry) => (entry.slot === slot ? recruited : entry)),
  }
}

/** 이미 그 자리로 영입된 모양 — 고칠 것이 없다 */
function isRecruitedPitcher(famer: HallOfFamePitcher, value: number): boolean {
  return famer.recordSlot === value && isClearedLine(famer.recordLine) && famer.stamina === FULL_STAMINA
}

/**
 * 명전 칸 삭제 — 스페셜 명예의 전당 말풍선 "슬롯에서 삭제" 확인 "예" (0x62994, R11 3-2):
 * 투수 칸 `0x22371(저장, 칸)` · 타자 칸 `0x22339(저장, 칸)` 이 시즌 명단 정리 0x221dc 뒤 칸 0x30 바이트를 0 으로
 * (`memset`, 0x1400428) — 빈 칸(상태 4)이 된다. 시즌 명단 정리는 `removeHallOfFamerFromRoster`(season-mode) 몫이다.
 * 없는 칸이면 같은 객체.
 */
export function deleteHallOfFame(collection: Collection, side: HallOfFameSide, slot: number): Collection {
  if (side === '투수') {
    if (hallOfFamePitcherAt(collection, slot) === null) return collection
    return { ...collection, hallOfFamePitchers: collection.hallOfFamePitchers.filter((famer) => famer.slot !== slot) }
  }
  if (hallOfFameBatterAt(collection, slot) === null) return collection
  return { ...collection, hallOfFame: collection.hallOfFame.filter((famer, index) => (famer.slot ?? index) !== slot) }
}
