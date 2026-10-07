import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherAbility } from '@/entities/pitcher-career/model/pitcherAbility'
import { PITCHER_ABILITY_ORDER } from '@/entities/pitcher-career/model/pitcherAbility'
import { EQUIPMENT_LEVEL_COUNT, FIRST_HIDDEN_LEVEL } from '@/entities/career/model/equipment'
import { ORIGINAL_ITEMS } from '@/shared/config/original/items'

/**
 * 나만의리그 **투수편(모드 3) 장비** — 타자편 `entities/career/model/equipment.ts` 와 **같은 코드**가
 * 모드로만 갈려 도는 자리다. 디스어셈으로 갈림목을 하나씩 확인했다 (모두 확정):
 *
 *   상점 키   0x13460 kind 3 (0x1349a~0x13630) — 미오픈(sel>6) → 보유 → 인기도 → 소지금 → StrMODE[79].
 *             모드 갈림은 두 곳뿐이다:
 *             · 해금표 `0x9f69d(app, mode==4, row, sel−7)` (0x134de) — 투수는 둘째 인자 0
 *             · 가격 `0xcc444[(row·11+sel) + (mode==3 ? 0 : 44)]` (0x13584 `cmp r3,#3`) — **투수는 앞 44칸**
 *   구매 확정 0x14a74 kind 3 — 소지금 −가격×10(0~9999), 보유 `rec[0x188+row·11+sel]=1`, **곧바로 장착**
 *             (니블 `rec2[0x19+row/2]`, row 짝수 = 상위) — 모드 갈림 없음.
 *             컬렉터 0xa5020(rec, row) = 레벨 0~6 일곱 칸을 다 가졌나 → `0x62368(id)` 의 id 가
 *             **mode==4 면 36·40·44·48, 아니면 20·24·28·32** (0x14bc4~0x14c8a).
 *   이름     0x832e8(win, row, sel) — `0x7b970`(타자편인가) 거짓이면 StrITEM[**44** / 55 / 66 / 77 + sel]
 *             (0x83316·0x8332c·0x83342·0x83358) → 모자·글러브·아대·신발 이름이 그대로 맞는다.
 *   힌트     창 0x83378 의 잠긴 히든 칸 (0x841aa~0x841d8) — `[win+0x24c]`(타자 깃발) 이 0 이면
 *             StrITEM[**186** + row·4 + sel − 7] ("나는야!N모자 컬렉터" 가 187 = sel 8).
 *   표시 가격 같은 창 0x83cb4~0x83d34 — 표 0xd4510(0xcc444 와 같은 값)을 타자면 +0x58 바이트 뒤에서 읽는다.
 *   효과     실효 능력치 0xb6414 가 능력치 칸 k 에 니블 k(`rec[0x19 + k/2]`, k 짝수 = 상위)의 0xd8890[n−1] 을
 *             더한다 (0xb646c~0xb64a8) → **부위 k = 능력치 칸 k** (제구·구속·변화·체력) — 추정이 아니다.
 *
 * 필요 인기도 0xcc50a 와 보너스 0xd8890 은 타자와 같은 표다.
 */

export interface PitcherEquipmentPart {
  readonly index: number
  /**
   * 부위 탭 이름 — ⚠️ **웹판 이름**. 원본 장비 창은 목록 행이 부위라 탭 글자가 따로 없다(R12 1b-가).
   * 그 부위 장비 이름(StrITEM 44~87: ~모자 · ~글러브 · ~아대 · ~신발)에서 땄다.
   */
  readonly name: string
  readonly ability: keyof PitcherAbility
}

export const PITCHER_EQUIPMENT_PARTS: readonly PitcherEquipmentPart[] = [
  { index: 0, name: '모자', ability: PITCHER_ABILITY_ORDER[0] },
  { index: 1, name: '글러브', ability: PITCHER_ABILITY_ORDER[1] },
  { index: 2, name: '아대', ability: PITCHER_ABILITY_ORDER[2] },
  { index: 3, name: '신발', ability: PITCHER_ABILITY_ORDER[3] },
]

/** 표 0xcc444 의 **앞 44칸**(s16) — 모드 3 은 덧셈 없이 읽는다 (0x13584). 단위 100만원 × 10 */
const PRICE_TABLE: readonly (readonly number[])[] = [
  [4, 8, 12, 18, 24, 32, 40, 80, 110, 150, 200],
  [5, 9, 14, 20, 27, 35, 45, 90, 120, 160, 210],
  [4, 8, 12, 18, 24, 32, 40, 80, 110, 150, 200],
  [3, 6, 10, 15, 21, 28, 36, 70, 100, 140, 190],
]
/** 만원 = 표 값 × 10(100만원 칸) × 100 — 타자편 `equipment.ts` 의 PRICE_UNIT 과 같다 */
const PRICE_UNIT = 1000
/** 필요 인기도 0xcc50a (s16) — 히든 7~10 은 0 */
const REQUIRED_POPULARITY = [0, 50, 150, 300, 450, 600, 800, 0, 0, 0, 0]
/** 이름 StrITEM[44 + 부위·11 + 레벨] (0x832e8) */
const NAME_START = 44
/** 히든 힌트 StrITEM[186 + 부위·4 + 레벨 − 7] (0x841b4) */
const HIDDEN_HINT_START = 186
const HIDDEN_LEVELS_PER_PART = 4
/**
 * 투수 히든 장비 오픈 id — 19 + 부위·4 + 레벨 − 7.
 * 컬렉터(레벨 8) id 가 20·24·28·32 로 확정이고(0x14bda…), 알림 뒷줄 StrCOMMON[142] 가
 * **19~34** 를 "나만의리그 투수편" 으로 묶는다(0x62368, R12 2-4) — 그 사이를 부위당 4칸으로 나눈 것이다.
 */
const PITCHER_HIDDEN_ID_START = 19
const COLLECTOR_LEVEL = 8

export interface PitcherEquipmentItem {
  readonly part: number
  readonly level: number
  readonly name: string
  /** 만원 */
  readonly price: number
  readonly requiredPopularity: number
  readonly isHidden: boolean
  readonly hiddenHint: string | null
}

export function pitcherEquipmentItemOf(part: number, level: number): PitcherEquipmentItem {
  const isHidden = level >= FIRST_HIDDEN_LEVEL
  return {
    part,
    level,
    name: ORIGINAL_ITEMS[NAME_START + part * EQUIPMENT_LEVEL_COUNT + level],
    price: PRICE_TABLE[part][level] * PRICE_UNIT,
    requiredPopularity: REQUIRED_POPULARITY[level],
    isHidden,
    hiddenHint: isHidden
      ? ORIGINAL_ITEMS[HIDDEN_HINT_START + part * HIDDEN_LEVELS_PER_PART + level - FIRST_HIDDEN_LEVEL]
      : null,
  }
}

export function pitcherHiddenOpenIdOf(part: number, level: number): number {
  return PITCHER_HIDDEN_ID_START + part * HIDDEN_LEVELS_PER_PART + level - FIRST_HIDDEN_LEVEL
}

const PITCHER_HIDDEN_ID_END = PITCHER_HIDDEN_ID_START + PITCHER_EQUIPMENT_PARTS.length * HIDDEN_LEVELS_PER_PART

/** StrCOMMON[139] "히든 아이템 오픈!! [%s]" + StrCOMMON[142] — 투수 id 가 아니면 null */
export function pitcherHiddenOpenTextOf(id: number): string | null {
  if (id < PITCHER_HIDDEN_ID_START || id >= PITCHER_HIDDEN_ID_END) return null
  const offset = id - PITCHER_HIDDEN_ID_START
  const item = pitcherEquipmentItemOf(
    Math.floor(offset / HIDDEN_LEVELS_PER_PART),
    FIRST_HIDDEN_LEVEL + (offset % HIDDEN_LEVELS_PER_PART),
  )
  return `히든 아이템 오픈!! [${item.name}] 나만의리그 투수편에서 사용가능합니다`
}

/** 보유 표시 — 타자편과 같은 "부위-레벨" 문자열 (`rec[0x188 + 부위·11 + 레벨]`) */
const keyOf = (part: number, level: number) => `${part}-${level}`

export const ownsPitcherEquipment = (career: PitcherCareer, part: number, level: number) =>
  career.ownedEquipment.includes(keyOf(part, level))

/** 0xa5020 — 레벨 0~6 일곱 칸을 다 가졌나 */
const isCollector = (career: PitcherCareer, part: number) =>
  Array.from({ length: FIRST_HIDDEN_LEVEL }, (_unused, level) => level).every((level) =>
    ownsPitcherEquipment(career, part, level))

/**
 * 히든 레벨이 열렸는가 — 원본은 **전역 해금표**(`app+0xc0`, 0x9f69c)만 본다. 웹은 커리어의 `openedHiddenIds`(앱이 전역 기록연감 것을
 * 얹어 넘긴다)가 그 표다. 컬렉터 칸(레벨 8)도 따로 보지 않는다 — 구매 확정 0x14a74(0x14bae~0x14c86)가 저장 직후 네 부위의 0xa5020 을
 * 보고 표에 켜 두기 때문이다(`purchasePitcherEquipment`). 그보다 앞서 산 옛 커리어는 불러올 때 보유에서 다시 센다
 * (`pitcherCollectorHiddenIdsOf` — `usePitcherLeagueSession` 의 불러오기 · 앱의 공용 해금 목록). 타자편 `isHiddenOpen` 과 같다.
 */
export function isPitcherHiddenOpen(career: PitcherCareer, part: number, level: number): boolean {
  if (level < FIRST_HIDDEN_LEVEL) return true
  return career.openedHiddenIds.includes(pitcherHiddenOpenIdOf(part, level))
}

export type PitcherEquipmentBlockReason = '미오픈' | '이미보유' | '인기도부족' | '소지금부족'

/** 0x13460 kind 3 의 가드 차례 그대로 — 미오픈(76) → 보유(78) → 인기도(62) → 소지금(77) */
export function pitcherEquipmentBlockReasonOf(
  career: PitcherCareer,
  part: number,
  level: number,
): PitcherEquipmentBlockReason | null {
  const item = pitcherEquipmentItemOf(part, level)
  if (!isPitcherHiddenOpen(career, part, level)) return '미오픈'
  if (ownsPitcherEquipment(career, part, level)) return '이미보유'
  if (career.popularity < item.requiredPopularity) return '인기도부족'
  return career.money < item.price ? '소지금부족' : null
}

const withLevel = (career: PitcherCareer, part: number, level: number): PitcherCareer => ({
  ...career,
  equipmentLevels: { ...career.equipmentLevels, [PITCHER_EQUIPMENT_PARTS[part].ability]: level + 1 },
})

const openHidden = (career: PitcherCareer, id: number): PitcherCareer =>
  career.openedHiddenIds.includes(id) ? career : { ...career, openedHiddenIds: [...career.openedHiddenIds, id] }

/** 구매 확정 0x14a74 kind 3 — 소지금을 깎고, 보유를 켜고, 곧바로 장착하고, 컬렉터면 해금한다 */
export function purchasePitcherEquipment(career: PitcherCareer, part: number, level: number): PitcherCareer {
  const blockReason = pitcherEquipmentBlockReasonOf(career, part, level)
  const item = pitcherEquipmentItemOf(part, level)
  if (blockReason !== null) throw new Error(`장비를 살 수 없습니다 (${blockReason}): ${item.name}`)
  const bought = withLevel(
    {
      ...career,
      // 0x14b2c 가 0 아래로 자르지만, 가드가 소지금 ≥ 가격을 이미 봤다
      money: career.money - item.price,
      ownedEquipment: [...career.ownedEquipment, keyOf(part, level)],
    },
    part,
    level,
  )
  // 0x14bae~0x14c86 — 저장 직후 **네 부위 모두** 0xa5020 을 보고 참인 부위마다 0x62368(ui, 컬렉터 id, 0)
  return PITCHER_EQUIPMENT_PARTS.reduce(
    (current, _part, index) =>
      (isCollector(current, index) ? openHidden(current, pitcherHiddenOpenIdOf(index, COLLECTOR_LEVEL)) : current),
    bought,
  )
}

/** 장비착용(121) — 가진 장비로 바꿔 낀다 (0x17ad0 → 확인 팝업 81, 니블에 sel+1) */
export function equipOwnedPitcherEquipment(career: PitcherCareer, part: number, level: number): PitcherCareer {
  if (!ownsPitcherEquipment(career, part, level)) {
    throw new Error(`가지고 있지 않은 장비입니다: ${pitcherEquipmentItemOf(part, level).name}`)
  }
  return withLevel(career, part, level)
}

/** 지금 장착한 레벨인가 (니블 = 레벨 + 1) */
export const isPitcherEquipmentEquipped = (career: PitcherCareer, part: number, level: number) =>
  career.equipmentLevels[PITCHER_EQUIPMENT_PARTS[part].ability] === level + 1
