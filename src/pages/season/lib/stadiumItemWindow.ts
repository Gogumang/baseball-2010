import { ORIGINAL_ITEMS } from '@/shared/config/original/items'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import {
  BOARD_BONUS_TABLE, STADIUM_HIDDEN_FIRST_SLOT, STADIUM_HIDDEN_UNLOCK_IDS, STADIUM_KINDS, STADIUM_PRICE_TABLE,
  STADIUM_SLOT_COUNTS, STAND_CAPACITY_TABLE, requiredPopularityOf, stadiumOwnedIndexOf,
} from '@/entities/season-mode/model/stadiumItems'
import type { StadiumKind } from '@/entities/season-mode/model/stadiumItems'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { EQUIPMENT_COLORS, EQUIPMENT_WINDOW } from '@/pages/season/lib/seasonEquipmentWindow'
import type { WindowBox } from '@/pages/season/lib/seasonEquipmentWindow'

/**
 * **구장 아이템 창 — 아이템 창 0x83378 의 창 종류 4** (시즌 0xdc 상점 · 0xea 구장관리 — 직접 떴다).
 * 장비 창(종류 3, `seasonEquipmentWindow`)과 같은 함수라 판 0x7c110 · 박스 0 세로선 넷 · 설명 상자 · 소지금 줄 · 부위(여기서는 종류)
 * 표시 · 칸 줄 고리 · 커서 테두리 · 굴림 막대는 그대로이고, 종류 4 만 갈리는 자리는 아래뿐이다:
 * ```
 * 833c0  0x7b998(창)(시즌) && [창+0x1a4] == 4 → 프레임 = mode_ui (0x80 / 4) = **32** (그 밖 30 · 31)
 *        — 박스는 31 과 같고 박스 4(설명)만 (27, 217, 100, 53) 이다. 그림은 관중석 · 전광판 · 잔디 아이콘 셋
 * 83630  이름표 줄 i = 0..2: 시즌 && 종류 ≠ 3 && i == 2 면 건너뛴다 → 302 소지금 · 303 가격 둘뿐(333 효과 없음)
 * 83802  칸 줄 글색 기본 (0x87, 0xf8, 0xff)
 *        [gfx+0x174] == 0xdc(상점) && 종류 4 && SR[0x188 + 7 × 종류 + 칸] ≠ 0(산 칸) → 글색 (0xce, 0xc7, 0xbd) · 막대 mode_ui 44
 *        종류 4 && (s8)SR[0x1b8 + 종류] == 칸(낀 칸) → 글색 (0x18, 0x2c, 0x6b) · 막대 mode_ui **43** (0x83982 — 산 칸 표시를 덮는다)
 *        막대가 있으면 0xb9e05(막대, 칸 박스, 0x22)
 * 83a1a  이름: 종류 4 && 칸 > 3 && 0x9f6c1(app, 종류, 칸 − 4) == 0 → "????"(0xd4c18), 그 밖 0x832a4 = StrITEM[(126 · 133 · 140) + 칸]
 *        — 0xba411(칸 박스, 글, 정렬 0x22). 잔디(4칸)는 칸 > 3 이 없다
 * 83c6e  커서 줄(초점 [창+0x1a8] ≠ 0): 가격 = 0xd45c0[8 × 종류 + 칸] × **10000** 만원(= 0xcbc64 와 같은 값 — 억 단위) — 노랑 글
 * 83dac  효과 v = 종류 == 2 ? 0 : 0xd44f4[7 × 종류 + 칸] — 둘째 이름표가 없어 효과 줄은 그리지 않고 설명에만 쓴다
 * 83e18  설명(박스 4, 0xba411 정렬 0x11, 5, 5) — `stadiumItemDescriptionOf`
 * ```
 * 목록(0x81766 종류 4): 종류 [창+0x198] = vt+0x10(3, 1, 1, 0x30) · 칸 [창+0x19c] = vt+0x1c(1, 7, 1, 0x30) — 깃발 0x30 이라 끝에서 감는다.
 * 칸 수 [창+0x1b0] 은 0x8146c 가 종류마다 7 · 7 · 4 로 채운다. 보이는 줄 다섯 · 굴림 0x6c2bd 는 장비 창과 같다.
 */
export const STADIUM_WINDOW = {
  ...EQUIPMENT_WINDOW,
  frame: 32,
  description: { x: 27, y: 217, width: 100, height: 53 },
  /** 이름표 302 소지금 · 303 가격 (83630 — 셋째 333 은 종류 3 만) */
  labelFrames: [302, 303],
  /** 낀 칸 막대 mode_ui 43 · 산 칸 막대 44 */
  equippedBarFrame: 43,
  ownedBarFrame: 44,
} as const

export const STADIUM_COLORS = {
  ...EQUIPMENT_COLORS,
  /** 낀 칸 글색 (0x18, 0x2c, 0x6b) — 0x83984 */
  equippedText: '#182c6b',
  /** 산 칸 글색 (0xce, 0xc7, 0xbd) — 0x83856 */
  ownedText: '#cec7bd',
} as const

const kindIndexOf = (kind: StadiumKind) => STADIUM_KINDS.indexOf(kind)

/** 칸 수 — 0x8146c 가 [창+0x1b0] 에 7 · 7 · 4 */
export const stadiumSlotCountOf = (kind: StadiumKind) => STADIUM_SLOT_COUNTS[kindIndexOf(kind)] ?? 0

/** 종류 목록 한 걸음 — 3 열 × 1 줄, 감는다 */
export function moveStadiumKind(kind: StadiumKind, step: -1 | 1): StadiumKind {
  const count = STADIUM_KINDS.length
  return STADIUM_KINDS[(kindIndexOf(kind) + step + count) % count] ?? kind
}

/** 칸 목록 한 걸음 — 1 열 × 칸 수, 감는다 */
export function moveStadiumSlot(kind: StadiumKind, slot: number, step: -1 | 1): number {
  const count = stadiumSlotCountOf(kind)
  return (slot + step + count) % count
}

/** 종류 표시 칸 — 박스 0 의 (x + 2 + 종류 × (w + 2), y, w, h) — 장비 창의 부위 표시와 같은 식 */
export function stadiumKindBoxOf(kind: StadiumKind): WindowBox {
  const box = STADIUM_WINDOW.partSlots
  return { ...box, x: box.x + 2 + kindIndexOf(kind) * (box.width + 2) }
}

/** 잠긴 히든 칸 — 종류 4 && 칸 > 3 && 해금표 0 (83a28 · 83e28) */
export function isLockedStadiumSlot(kind: StadiumKind, slot: number, isHiddenOpen: (unlockId: number) => boolean): boolean {
  if (slot < STADIUM_HIDDEN_FIRST_SLOT) return false
  const unlockId = STADIUM_HIDDEN_UNLOCK_IDS[kindIndexOf(kind)]?.[slot - STADIUM_HIDDEN_FIRST_SLOT]
  return unlockId !== undefined && !isHiddenOpen(unlockId)
}

const NAME_BASE: Readonly<Record<StadiumKind, number>> = { 관중석: 126, 전광판: 133, 잔디: 140 }
/** 0xd4c18 */
export const LOCKED_STADIUM_NAME = '????'

/** 구장 아이템 이름 — 0x832a4: StrITEM[(126 · 133 · 140) + 칸] */
export function stadiumItemNameOf(kind: StadiumKind, slot: number): string {
  return ORIGINAL_ITEMS[NAME_BASE[kind] + slot] ?? ''
}

/** 창 칸 글 — 잠긴 히든 칸은 "????" */
export function stadiumRowNameOf(kind: StadiumKind, slot: number, isHiddenOpen: (unlockId: number) => boolean): string {
  return isLockedStadiumSlot(kind, slot, isHiddenOpen) ? LOCKED_STADIUM_NAME : stadiumItemNameOf(kind, slot)
}

export interface StadiumRowLook {
  readonly color: string
  /** 막대 mode_ui 프레임 — 없으면 null */
  readonly bar: number | null
}

/** 칸 줄 글색 · 막대 (0x83802~0x83990) — 상점은 산 칸을, 둘 다 낀 칸을 따로 칠한다 */
export function stadiumRowLookOf(record: SeasonRecord, kind: StadiumKind, slot: number, isShop: boolean): StadiumRowLook {
  const kindIndex = kindIndexOf(kind)
  if (record.stadiumEquipped[kindIndex] === slot) return { color: STADIUM_COLORS.equippedText, bar: STADIUM_WINDOW.equippedBarFrame }
  const owned = record.stadiumOwned[stadiumOwnedIndexOf(kind, slot)] ?? false
  if (isShop && owned) return { color: STADIUM_COLORS.ownedText, bar: STADIUM_WINDOW.ownedBarFrame }
  return { color: STADIUM_COLORS.itemText, bar: null }
}

/** 가격 칸 — 0xd45c0[8 × 종류 + 칸] × 10000 만원 (0x83c80~0x83c88 · 0x83d3c) */
export function stadiumPriceTenThousandsOf(kind: StadiumKind, slot: number): number {
  return (STADIUM_PRICE_TABLE[kindIndexOf(kind)]?.[slot] ?? 0) * 10000
}

/** StrITEM[184] "인기도 제한 없음" · [185] "인기도 %d 이상" · 히든 힌트 245 + 칸 (+3 전광판) · 잔디 설명 144 + 칸 */
const NO_POPULARITY_LIMIT = 184
const POPULARITY_LIMIT_FORMAT = 185
const HIDDEN_HINT_BASE = 245
const BOARD_HINT_SHIFT = 3
const GRASS_DESCRIPTION_BASE = 144
/** StrMODE[218] "관중" */
const CROWD_TEXT = 218

/**
 * 설명 상자 글 (0x83de8~0x83f46, 직접 떴다 — R12 4절의 차례는 효과 줄이 앞이라 적었으나 0x83f30 · 0x83f38 · 0x83f40 의 이어 붙이기는
 * **인기도 줄 → "!N" → 효과 줄** 차례다):
 * ```
 * 잠긴 히든 칸     StrITEM[245 + 칸 (+3 전광판)] 한 줄
 * 잔디             StrITEM[144 + 칸]
 * 관중석 · 전광판  p = 0xd44c4[8 × 종류 + 칸] == 0 ? StrITEM[184] : sprintf(StrITEM[185], p)
 *                  + "!N" + (관중석 sprintf("%d명 수용!N가능", v × 1000) · 전광판 sprintf("%s +%d", StrMODE[218], v × 1000))
 * ```
 */
export function stadiumItemDescriptionOf(kind: StadiumKind, slot: number, isHiddenOpen: (unlockId: number) => boolean): string {
  if (isLockedStadiumSlot(kind, slot, isHiddenOpen)) {
    return ORIGINAL_ITEMS[HIDDEN_HINT_BASE + slot + (kind === '전광판' ? BOARD_HINT_SHIFT : 0)] ?? ''
  }
  if (kind === '잔디') return ORIGINAL_ITEMS[GRASS_DESCRIPTION_BASE + slot] ?? ''
  const required = requiredPopularityOf(kind, slot) ?? 0
  const popularity = required === 0
    ? ORIGINAL_ITEMS[NO_POPULARITY_LIMIT] ?? ''
    : (ORIGINAL_ITEMS[POPULARITY_LIMIT_FORMAT] ?? '').replace('%d', String(required))
  const effect = kind === '관중석'
    ? `${(STAND_CAPACITY_TABLE[slot] ?? 0) * 1000}명 수용!N가능`
    : `${ORIGINAL_MODE_TEXT[CROWD_TEXT] ?? ''} +${(BOARD_BONUS_TABLE[slot] ?? 0) * 1000}`
  return `${popularity}!N${effect}`
}
