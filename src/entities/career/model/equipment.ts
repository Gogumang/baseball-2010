import type { BatterAbility } from '@/entities/batting/model/batter'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { ORIGINAL_ITEMS } from '@/shared/config/original/items'

/**
 * 장착 아이템 (타자편 — 누락 탐색 4·6차, 바이트 확인).
 *   선택   (부위 0~3, 레벨 0~10). 부위 i 는 능력치 i (히트·파워·수비·주루) 에 보너스를 준다
 *   이름   StrITEM[부위×11 + 레벨] (11개 묶음 — 추정이지만 이름이 부위와 정확히 맞는다)
 *   가격   표 0xcc444[44 + 부위×11+레벨] × 10 (100만원) → 웹판 만원 × 1000
 *   인기도 표 0xcc50a[레벨] — 레벨 7~10 은 0 이고 히든(특수 조건으로 오픈, StrMODE[76])
 *   구매   보유 플래그(+0x188+부위×11+레벨)를 켜고 그 레벨을 곧바로 장착한다 (니블 +0x19/+0x1a = 레벨+1)
 *   보너스 실효 능력치에 표 0xd8890[니블−1] 을 더한다 (0xb6414)
 */
export type EquipmentLevels = BatterAbility

export interface EquipmentPart {
  readonly index: number
  readonly name: string
  readonly ability: keyof BatterAbility
}

export const EQUIPMENT_PARTS: readonly EquipmentPart[] = [
  { index: 0, name: '헬멧', ability: 'hit' },
  { index: 1, name: '배트', ability: 'power' },
  { index: 2, name: '밴드', ability: 'defense' },
  { index: 3, name: '슈즈', ability: 'run' },
]

export const EQUIPMENT_LEVEL_COUNT = 11
/** 표 0xcc444 의 행 4~7 — 타자(모드 4)는 +0x58 바이트(44칸) 뒤를 쓴다 (0x14aaa, 점검 11차) */
const PRICE_TABLE = [
  [5, 9, 14, 20, 27, 35, 45, 90, 120, 150, 200],
  [5, 9, 14, 20, 27, 35, 45, 90, 120, 160, 210],
  [3, 6, 10, 15, 21, 28, 36, 70, 100, 140, 190],
  [3, 6, 10, 15, 21, 28, 36, 70, 100, 140, 190],
]
const PRICE_UNIT = 1000
const REQUIRED_POPULARITY = [0, 50, 150, 300, 450, 600, 800, 0, 0, 0, 0]
export const FIRST_HIDDEN_LEVEL = 7
const LEVEL_BONUS = [30, 50, 70, 90, 110, 125, 140, 190, 210, 230, 250]
/** 히든 오픈 힌트 — 타자 부위는 StrITEM[202] 부터 부위당 4줄 */
const HIDDEN_HINT_START = 202
const HIDDEN_HINTS_PER_PART = 4

export interface EquipmentItem {
  readonly part: number
  readonly level: number
  readonly name: string
  /** 만원 */
  readonly price: number
  readonly requiredPopularity: number
  readonly isHidden: boolean
  /** 히든 레벨의 오픈 힌트 (StrITEM[202~217]) */
  readonly hiddenHint: string | null
}

export function equipmentItemOf(part: number, level: number): EquipmentItem {
  const isHidden = level >= FIRST_HIDDEN_LEVEL
  return {
    part,
    level,
    name: ORIGINAL_ITEMS[part * EQUIPMENT_LEVEL_COUNT + level],
    price: PRICE_TABLE[part][level] * PRICE_UNIT,
    requiredPopularity: REQUIRED_POPULARITY[level],
    isHidden,
    hiddenHint: isHidden
      ? ORIGINAL_ITEMS[HIDDEN_HINT_START + part * HIDDEN_HINTS_PER_PART + level - FIRST_HIDDEN_LEVEL]
      : null,
  }
}

const keyOf = (part: number, level: number) => `${part}-${level}`
export const ownsEquipment = (career: PlayerCareer, part: number, level: number) =>
  career.ownedEquipment.includes(keyOf(part, level))

/** 컬렉터 레벨 — 힌트 둘째 줄 "○○ 컬렉터" = 레벨 8 (0xa5020 이 타자 id 36/40/44/48 을 연다) */
const COLLECTOR_LEVEL = 8

/**
 * 히든 레벨이 열렸는가. 레벨 0~6 을 모두 가지면 컬렉터 칸(레벨 8)이 열린다 (0xa5020).
 * 원본 오픈 비트는 전역 저장(game_o.sav)에 있고 이벤트 304~307(보상 7)·미션 올 클리어 등으로도 열리지만
 * 웹판은 아직 컬렉터 조건만 본다 (누락 탐색 7차 표 참고).
 */
/**
 * 타자 장비 오픈 id (헬멧 35~38 · 배트 39~42 · 밴드 43~46 · 슈즈 47~50, 0x61f5c).
 * 부위를 다 모았을 때 열리는 **컬렉터 id 는 타자 36·40·44·48** 이다 (R12 5절 확정).
 * 투수 쪽은 20·24·28·32 인데 웹에 투수편이 없어 아직 쓰지 않는다.
 */
const BATTER_HIDDEN_ID_START = 35
const HIDDEN_LEVELS_PER_PART = 4

export function hiddenOpenIdOf(part: number, level: number): number {
  return BATTER_HIDDEN_ID_START + part * HIDDEN_LEVELS_PER_PART + level - FIRST_HIDDEN_LEVEL
}

const isCollector = (career: PlayerCareer, part: number) =>
  Array.from({ length: FIRST_HIDDEN_LEVEL }, (_unused, index) => index).every((owned) => ownsEquipment(career, part, owned))

export function isHiddenOpen(career: PlayerCareer, part: number, level: number): boolean {
  if (level < FIRST_HIDDEN_LEVEL) return true
  if (career.openedHiddenIds.includes(hiddenOpenIdOf(part, level))) return true
  return level === COLLECTOR_LEVEL && isCollector(career, part)
}

const BATTER_HIDDEN_ID_END = BATTER_HIDDEN_ID_START + EQUIPMENT_PARTS.length * HIDDEN_LEVELS_PER_PART

/**
 * 히든 오픈 알림 — StrCOMMON[139] "히든 아이템 오픈!! [%s]" 뒤에 **쓰는 곳을 알리는 뒷줄**이 붙는다.
 * 뒷줄은 id 로 갈린다 (R12 5절 확정): **13~18 시즌모드**(StrCOMMON[141]) ·
 * **19~34 나만의리그 투수편**(142) · **35~50 나만의리그 타자편**(143).
 * 앞서 웹은 타자 id 만 다루고 뒷줄도 타자 문구로 고정돼 있었다.
 */
const SEASON_HIDDEN_ID_RANGE = { first: 13, last: 18 }
const PITCHER_HIDDEN_ID_RANGE = { first: 19, last: 34 }

export function hiddenOpenTextOf(id: number): string | null {
  if (id >= SEASON_HIDDEN_ID_RANGE.first && id <= SEASON_HIDDEN_ID_RANGE.last) {
    // 구장 아이템(관중석·전광판) — 이름은 시즌 구단관리 쪽이라 아직 없다
    return '히든 아이템 오픈!! 시즌모드에서 사용가능합니다'
  }
  if (id >= PITCHER_HIDDEN_ID_RANGE.first && id <= PITCHER_HIDDEN_ID_RANGE.last) {
    return '히든 아이템 오픈!! 나만의리그 투수편에서 사용가능합니다'
  }
  if (id < BATTER_HIDDEN_ID_START || id >= BATTER_HIDDEN_ID_END) return null
  const offset = id - BATTER_HIDDEN_ID_START
  const item = equipmentItemOf(Math.floor(offset / HIDDEN_LEVELS_PER_PART), FIRST_HIDDEN_LEVEL + (offset % HIDDEN_LEVELS_PER_PART))
  return `히든 아이템 오픈!! [${item.name}] 나만의리그 타자편에서 사용가능합니다`
}

/** 오픈 id 를 기록한다 (0x62368). 원본은 전역 저장이라 앱이 기록연감으로도 옮긴다 */
export function openHidden(career: PlayerCareer, id: number): PlayerCareer {
  if (career.openedHiddenIds.includes(id)) return career
  return { ...career, openedHiddenIds: [...career.openedHiddenIds, id] }
}

export type EquipmentBlockReason = '미오픈' | '이미보유' | '인기도부족' | '소지금부족'

export function equipmentBlockReasonOf(career: PlayerCareer, part: number, level: number): EquipmentBlockReason | null {
  const item = equipmentItemOf(part, level)
  if (!isHiddenOpen(career, part, level)) return '미오픈'
  if (ownsEquipment(career, part, level)) return '이미보유'
  if (career.popularity < item.requiredPopularity) return '인기도부족'
  return career.money < item.price ? '소지금부족' : null
}

const withLevel = (career: PlayerCareer, part: number, level: number): PlayerCareer => ({
  ...career,
  equipmentLevels: { ...career.equipmentLevels, [EQUIPMENT_PARTS[part].ability]: level + 1 },
})

export function purchaseEquipment(career: PlayerCareer, part: number, level: number): PlayerCareer {
  const blockReason = equipmentBlockReasonOf(career, part, level)
  const item = equipmentItemOf(part, level)
  if (blockReason !== null) throw new Error(`장비를 살 수 없습니다 (${blockReason}): ${item.name}`)
  const bought = withLevel(
    { ...career, money: career.money - item.price, ownedEquipment: [...career.ownedEquipment, keyOf(part, level)] },
    part,
    level,
  )
  return isCollector(bought, part) ? openHidden(bought, hiddenOpenIdOf(part, COLLECTOR_LEVEL)) : bought
}

/** 산 적 있는 장비로 바꿔 낀다 */
export function equipOwned(career: PlayerCareer, part: number, level: number): PlayerCareer {
  if (!ownsEquipment(career, part, level)) throw new Error(`가지고 있지 않은 장비입니다: ${equipmentItemOf(part, level).name}`)
  return withLevel(career, part, level)
}

/** 니블 값(0 = 미장착, 1~11) → 능력치 보너스 */
export function equipmentBonusOf(nibble: number): number {
  return nibble <= 0 ? 0 : LEVEL_BONUS[nibble - 1]
}
