import { MONEY_LIMIT, clampTo } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'

/**
 * 시즌 구장 아이템(관중석·전광판·잔디) — `docs/re/S3-stadium-items.md` **확정**.
 *
 * 처리하는 자리는 시즌 쪽 `0x957c`(키·가드) 와 `0x7d90`(팝업 결과, 코드 14 구매·15 해금),
 * 교체는 구단관리-구장관리 `0x7958` 이다. (R12 가 본 `0x13460`/`0x14a74` 는 **나리** 쪽이라
 * "kind 4 는 아무것도 안 한다" 는 시즌에는 해당되지 않는다.)
 */
export const STADIUM_KINDS = ['관중석', '전광판', '잔디'] as const
export type StadiumKind = (typeof STADIUM_KINDS)[number]

/** 종류별 칸 수 — 관중석·전광판 7칸(4~6 이 히든), 잔디 4칸(히든 없음) */
export const STADIUM_SLOT_COUNTS: readonly number[] = [7, 7, 4]

/** 보유 플래그의 자리 = `SR+0x188 + 7×종류 + 칸` (S3 2절). 종류마다 7칸씩 고정이다 */
export const STADIUM_OWNED_STRIDE = 7

/**
 * **진짜 가격 표 `0xcbc64`** (s16). 실제 가격 = 표값 × 100 (100만 단위) = 표값 억 원.
 *
 * ⚠️ J 4-9 가 가격이라고 적은 `0xd44c4` 는 **필요 인기도**(`0xcbc34` 의 사본)였다
 * (S3 3절 · CORRECTIONS "J 4-9"). 잔디도 행이 있다 — 1억·2억·3억.
 *
 * 원본 표는 한 줄 8칸(`idx = (종류 << 3) + 칸`)이지만 칸 상한이 7·7·4 라 8번째 칸은
 * 어디서도 읽히지 않는다. 그래서 읽히는 칸만 적었다.
 */
export const STADIUM_PRICE_TABLE: readonly (readonly number[])[] = [
  [0, 3, 6, 10, 20, 20, 20], // 관중석 — 3·6·10·20억 (히든 3칸은 4번과 같은 값)
  [0, 2, 4, 7, 15, 15, 15], // 전광판 — 2·4·7·15억
  [0, 1, 2, 3], // 잔디 — 1·2·3억
]

/** 필요 인기도 표 `0xcbc34` (s16). `0xd44c4` 는 이것의 바이트까지 같은 사본이고 설명 줄 전용이다 */
export const STADIUM_REQUIRED_POPULARITY: readonly (readonly number[])[] = [
  [0, 200, 500, 800, 1000, 1000, 1000],
  [0, 100, 400, 700, 900, 900, 900],
  [0, 0, 0, 0], // 잔디는 인기도 제한이 없다
]

/** 가격 표값을 소지금 단위(100만)로 (0x9ada·0x8166 의 `× 100`) */
export const STADIUM_PRICE_SCALE = 100

/** 관중석 수용 상한 표 `0xd7cc4` 앞 7칸 (천 명 단위) */
export const STAND_CAPACITY_TABLE: readonly number[] = [20, 25, 30, 35, 40, 40, 40]
/** 전광판 관중 가산 표 `0xd7cc4` **+7칸** (천 명 단위) */
export const BOARD_BONUS_TABLE: readonly number[] = [0, 2, 3, 4, 5, 5, 5]

/** 히든이 시작되는 칸 (0~3 이 기본, 4~6 이 히든) */
export const STADIUM_HIDDEN_FIRST_SLOT = 4
/** 컬렉터 판정이 보는 기본 칸 수 — `0xa38c4` 는 0~3 넷을 센다 */
export const STADIUM_BASIC_SLOTS = 4

/**
 * 히든 해금 id (`0x620b8` 표). 관중석 13·14·15 · 전광판 16·17·18,
 * 저장 위치는 `app[0xe0 + 종류×4 + (칸−4)]` 다 (S3 7절).
 * 잔디에는 히든이 없다.
 */
export const STADIUM_HIDDEN_UNLOCK_IDS: readonly (readonly number[])[] = [[13, 14, 15], [16, 17, 18], []]
/** 컬렉터(기본 4칸 전부 보유)로 열리는 id — 관중석 13 · 전광판 16 (0x81ea·0x820c) */
export const STADIUM_COLLECTOR_UNLOCK_IDS: readonly (number | null)[] = [13, 16, null]

const kindIndexOf = (kind: StadiumKind): number => STADIUM_KINDS.indexOf(kind)

/** 가격 (100만 원 단위). 없는 칸이면 null */
export function stadiumPriceOf(kind: StadiumKind, slot: number): number | null {
  const table = STADIUM_PRICE_TABLE[kindIndexOf(kind)]
  const value = table[slot]
  return value === undefined ? null : value * STADIUM_PRICE_SCALE
}

/** 필요 인기도. 없는 칸이면 null */
export function requiredPopularityOf(kind: StadiumKind, slot: number): number | null {
  const table = STADIUM_REQUIRED_POPULARITY[kindIndexOf(kind)]
  return table[slot] ?? null
}

/** 보유 플래그 자리 = `0x188 + 7×종류 + 칸` */
export function stadiumOwnedIndexOf(kind: StadiumKind, slot: number): number {
  return kindIndexOf(kind) * STADIUM_OWNED_STRIDE + slot
}

export function ownsStadiumItem(record: SeasonRecord, kind: StadiumKind, slot: number): boolean {
  return record.stadiumOwned[stadiumOwnedIndexOf(kind, slot)] === true
}

/** 히든 칸인가 — 잔디(4칸)에는 히든이 없다 (0x9afc: `종류 != 2 && k > 3`) */
export function isHiddenStadiumSlot(kind: StadiumKind, slot: number): boolean {
  return kind !== '잔디' && slot >= STADIUM_HIDDEN_FIRST_SLOT
}

export type StadiumPurchaseRefusal = '없는칸' | '미오픈' | '이미보유' | '인기도부족' | '소지금부족'

export type StadiumPurchaseCheck =
  | { readonly ok: true; readonly price: number }
  | { readonly ok: false; readonly reason: StadiumPurchaseRefusal; readonly required?: number }

/**
 * 구매 가드 — 원본 `0x9a84~0x9bd2` 의 **순서 그대로** (S3 4절).
 *   1. 미오픈 (StrMODE[76]) → 2. 이미 보유 (StrMODE[78] 계열)
 *   → 3. 인기도 부족 (StrMODE[62] "필요한 인기도 : %d") → 4. 소지금 부족 (StrMODE[77])
 *   → 통과하면 StrMODE[79] 확인 팝업(결과코드 14)
 *
 * `isHiddenOpen(id)` 는 해금 플래그 `app[0xe0 + 종류×4 + (칸−4)]` 를 보는 콜백이다.
 */
export function checkStadiumPurchase(
  record: SeasonRecord,
  popularity: number,
  kind: StadiumKind,
  slot: number,
  isHiddenOpen: (unlockId: number) => boolean,
): StadiumPurchaseCheck {
  const price = stadiumPriceOf(kind, slot)
  const required = requiredPopularityOf(kind, slot)
  if (price === null || required === null) return { ok: false, reason: '없는칸' }

  if (isHiddenStadiumSlot(kind, slot)) {
    const unlockId = STADIUM_HIDDEN_UNLOCK_IDS[kindIndexOf(kind)][slot - STADIUM_HIDDEN_FIRST_SLOT]
    if (unlockId === undefined || !isHiddenOpen(unlockId)) return { ok: false, reason: '미오픈' }
  }
  if (ownsStadiumItem(record, kind, slot)) return { ok: false, reason: '이미보유' }
  if (popularity < required) return { ok: false, reason: '인기도부족', required }
  if (record.money < price) return { ok: false, reason: '소지금부족', required: price }
  return { ok: true, price }
}

/**
 * 구매 확정 — 원본 `0x812c` (S3 5-1).
 * ```
 * [rec+2] = clamp(소지금 − 가격, 0, 9999)
 * rec[0x188 + 7×종류 + 칸] = 1
 * rec[0x1b8 + 종류]        = 칸        ← 그 자리에서 바로 장착된다
 * ```
 * ⚠️ **인기도는 깎지 않는다.** 인기도는 조건일 뿐이고 차감하는 코드가 없다 (S3 5-1 확정).
 * 그래서 이 함수는 인기도를 인자로만 받고 돌려주지 않는다.
 *
 * 가드는 부르는 쪽에서 `checkStadiumPurchase` 로 먼저 본다 — 원본도 키 핸들러(0x957c)가
 * 가드를, 팝업 결과(0x7d90)가 차감을 맡는 두 함수로 나뉘어 있다.
 */
export function buyStadiumItem(record: SeasonRecord, kind: StadiumKind, slot: number): SeasonRecord {
  const price = stadiumPriceOf(kind, slot)
  if (price === null) return record
  const index = stadiumOwnedIndexOf(kind, slot)
  return {
    ...record,
    money: clampTo(record.money - price, MONEY_LIMIT),
    stadiumOwned: record.stadiumOwned.map((owned, position) => (position === index ? true : owned)),
    stadiumEquipped: record.stadiumEquipped.map((current, position) =>
      position === kindIndexOf(kind) ? slot : current,
    ),
  }
}

/**
 * 교체 — 구단관리-구장관리 `0x7958`. `rec[0x1b8 + 종류] = 선택칸` **한 줄이 전부**다.
 *
 * ⚠️ **가드가 하나도 없다** (S3 6절 확정): 가격·인기도·보유 어느 것도 보지 않는다.
 * 목록에 보유분만 올린다는 뜻으로 읽히지만 목록을 채우는 코드는 안 읽었으므로,
 * 원본대로 여기서도 막지 않는다 — 안 산 칸도 그대로 끼워진다.
 */
export function equipStadiumItem(record: SeasonRecord, kind: StadiumKind, slot: number): SeasonRecord {
  return {
    ...record,
    stadiumEquipped: record.stadiumEquipped.map((current, position) =>
      position === kindIndexOf(kind) ? slot : current,
    ),
  }
}

/** 컬렉터 판정 `0xa38c4(rec, 종류)` — 기본 4칸(0~3)을 모두 보유했는가 */
export function isStadiumCollector(record: SeasonRecord, kind: StadiumKind): boolean {
  for (let slot = 0; slot < STADIUM_BASIC_SLOTS; slot += 1) {
    if (!ownsStadiumItem(record, kind, slot)) return false
  }
  return true
}

/**
 * 구매 완료 팝업이 닫힐 때 여는 해금 id — 원본 `0x81d0` (S3 5-2).
 * 관중석 4칸을 다 모으면 13, 전광판이면 16. 잔디에는 컬렉터가 없다.
 */
export function stadiumCollectorUnlocks(record: SeasonRecord): number[] {
  const opened: number[] = []
  STADIUM_KINDS.forEach((kind, index) => {
    const id = STADIUM_COLLECTOR_UNLOCK_IDS[index]
    if (id !== null && isStadiumCollector(record, kind)) opened.push(id)
  })
  return opened
}

/** 지금 장착한 관중석의 수용 상한 (명) — `0xd7cc4[칸] × 1000` */
export function standCapacityOf(record: SeasonRecord): number {
  return (STAND_CAPACITY_TABLE[record.stadiumEquipped[0]] ?? 0) * 1000
}

/** 지금 장착한 전광판의 관중 가산 (명) — `0xd7cc4[7 + 칸] × 1000` */
export function boardBonusOf(record: SeasonRecord): number {
  return (BOARD_BONUS_TABLE[record.stadiumEquipped[1]] ?? 0) * 1000
}

/**
 * ⚠️ **잔디는 어떤 계산에도 들어가지 않는다** (S3 8절 확정).
 * 읽는 곳이 전부 구장 그림·미리보기뿐인 **순수 겉모습**인데 1억·2억·3억을 받는다.
 * 그래서 관중 수 계산에 쓰는 함수가 여기 없다 — 없는 게 원본과 같다.
 */
export const GRASS_HAS_NO_EFFECT = true

/**
 * 시즌 **홈경기** 타석 배경에 넘기는 세 값 — 경기 준비 `0x353ac~0x353e6` 이
 * 시즌 기록에서 구장 객체로 옮겨 담는 그대로다 (**확정**, 주소 다시 뜸).
 *
 * ```
 * 353ac  구장+0x88 = (s8)SR[0x1b8]      ; 관중석 칸
 * 353c2  구장+0x89 = (s8)SR[0x65] + 1   ; 관중 수 그림 단계
 * 353d2  구장+0x8a = (s8)SR[0x1b9]      ; 전광판 칸
 * ```
 *
 * ⚠️ 잔디 칸(SR+0x1ba)은 여기 없다 — 프레임이 아니라 팔레트라 다른 길로 간다.
 */
export interface SeasonStadiumScene {
  /** 구장+0x88 — 관중석 칸 0~6 (4~6 은 히든) */
  readonly stand: number
  /** 구장+0x89 — 관중 수 그림 단계 (0 빈 좌석 · 1 적음 · 2 보통 · 3 만원) */
  readonly crowd: number
  /** 구장+0x8a — 전광판 칸 0~6 (4~6 은 히든) */
  readonly board: number
}

/**
 * 시즌 기록 → 구장 객체 세 칸 (`0x353ac~0x353e6`).
 *
 * `crowd` 는 **만원 판정 `SR+0x65` + 1** 이다. 그 칸은 경기가 끝날 때 관중·수입 계산
 * `0xa34b8` 끝에서 서고(`0xa36ae~0xa36ca`: 관중 ≥ 수용×80/100 → 2, > 수용×35/100 → 1, 그 밖 0),
 * 다음 경기 준비가 그 값을 그대로 읽는다. 곧 타석에 뜨는 관중 수는 **직전 경기의 것**이고
 * 첫 경기는 0(+1 = "적음")이다 — 원본 그대로다.
 */
export function seasonStadiumOf(record: SeasonRecord): SeasonStadiumScene {
  return {
    stand: record.stadiumEquipped[0] ?? 0,
    crowd: record.crowdLevel + 1,
    board: record.stadiumEquipped[1] ?? 0,
  }
}
