import type { AnnalsStats } from '@/entities/collection/model/annalsStats'
import { gamePointEarnedOf, gamePointUsageOf, itemPurchaseCountOf } from '@/entities/collection/model/annalsStats'
import { STAT_NAME_FIRST_INDEX } from '@/pages/record/lib/statNames'

/**
 * 기록연감 **탭 4 통계** 의 칸 — 격자 종류 2 의 칸 그리기 `0x7a9cc` → `0x7a08c` (디스어셈 확정).
 *
 * 칸 번호 = **쪽 × 8 + 줄** (`0x7a9d4~0x7a9e6`: `[skin+0xfc] << 3` + 줄). 번호마다 이름 StrMAINMENU[…] 와 값이 정해져 있고,
 * 표에 없는 번호(7 · 13~15 · 26~31 · 47 · 55)는 **아무것도 안 그린다** — 그래서 쪽마다 줄 수가 다르다.
 *
 * | 칸 | 이름 | 값 | 꼴 |
 * |---|---|---|---|
 * | 0~6 | [129]~[135] 모드별 | 저장 `+0x2c + 8i` u64 밀리초 | `"%04d:%02d:%02d"` (0xd4150) |
 * | 8~12 | [136]~[140] 우승·추천·이벤트 | 저장 `+0xfc + 2i` u16 | `"%d회"` (0xd416c) |
 * | 16~25 | [141]~[150] 타자 아이템 | `0x22eb5(4, i)` | `"%d개"` (0xd417c) |
 * | 32~39 | [151]~[158] 투수 아이템 | `0x22eb5(3, i)` — **i 8·9([159]·[160])는 칸이 없다** | `"%d개"` |
 * | 40~46 | [161]~[167] 시즌 아이템 | `0x22eb5(2, i)` | `"%d개"` |
 * | 48~54 | [168]~[174] 모드별 획득 GP | `0x2325d(i)` = 저장 `+0x8c + 4i` | `"%dG"` (0xd418c) |
 * | 56~63 | [175]~[182] 사용처별 소모 GP | `0x2322d(i)` = 저장 `+0x6c + 4i` | `"%dG"` |
 *
 * 줄 글: 이름 `"!cffffff%s"` 흰 글을 (x + 3, y + 1, 폭 − 10), 값 `"!R!cffff00…"` 노랑 오른쪽 맞춤을 (x − 2, y, 폭 − 4).
 */
export type StatValueKind = '시간' | '횟수' | '개수' | 'G'

export interface StatCell {
  /** StrMAINMENU 번호 */
  readonly nameIndex: number
  readonly valueKind: StatValueKind
  /** 값을 읽는다 — 웹이 아직 저장하지 않는 칸이면 null */
  readonly valueOf: (stats: AnnalsStats) => number | null
}

const NOT_SAVED = () => null

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, offset) => from + offset)

const STAT_CELLS: ReadonlyMap<number, StatCell> = new Map<number, StatCell>([
  // 플레이 시간 — 웹은 저장하지 않는다
  ...range(0, 6).map((id): [number, StatCell] => [id, { nameIndex: 129 + id, valueKind: '시간', valueOf: NOT_SAVED }]),
  // 우승 횟수·친구 추천·이벤트 미션 다운 — 웹은 저장하지 않는다
  ...range(8, 12).map((id): [number, StatCell] => [id, { nameIndex: 136 + id - 8, valueKind: '횟수', valueOf: NOT_SAVED }]),
  ...range(16, 25).map((id): [number, StatCell] => [id, {
    nameIndex: 141 + id - 16, valueKind: '개수', valueOf: (stats) => itemPurchaseCountOf(stats, 4, id - 16),
  }]),
  ...range(32, 39).map((id): [number, StatCell] => [id, {
    nameIndex: 151 + id - 32, valueKind: '개수', valueOf: (stats) => itemPurchaseCountOf(stats, 3, id - 32),
  }]),
  ...range(40, 46).map((id): [number, StatCell] => [id, {
    nameIndex: 161 + id - 40, valueKind: '개수', valueOf: (stats) => itemPurchaseCountOf(stats, 2, id - 40),
  }]),
  // 모드별 획득 GP (0x22c7d 가 쌓는다)
  ...range(48, 54).map((id): [number, StatCell] => [id, {
    nameIndex: 168 + id - 48, valueKind: 'G', valueOf: (stats) => gamePointEarnedOf(stats, id - 48),
  }]),
  ...range(56, 63).map((id): [number, StatCell] => [id, {
    nameIndex: 175 + id - 56, valueKind: 'G', valueOf: (stats) => gamePointUsageOf(stats, id - 56),
  }]),
])

export const STAT_ROWS_PER_PAGE = 8

/** 칸 번호의 내용 — 비어 있는 번호면 null */
export function statCellOf(cellId: number): StatCell | null {
  return STAT_CELLS.get(cellId) ?? null
}

/** 쪽 하나의 줄 8개 (빈 줄은 null) */
export function statPageCellsOf(page: number): readonly (StatCell | null)[] {
  return range(0, STAT_ROWS_PER_PAGE - 1).map((row) => statCellOf(page * STAT_ROWS_PER_PAGE + row))
}

/** 값 글 — 원본 꼴 그대로 (색·정렬 표시는 화면이 맡는다) */
export function statValueTextOf(kind: StatValueKind, value: number): string {
  if (kind === '횟수') return `${value}회`
  if (kind === '개수') return `${value}개`
  if (kind === 'G') return `${value}G`
  // `%04d:%02d:%02d` — 밀리초를 1000 으로 나눈 초를 시·분·초로 (0x7a19a~0x7a1dc)
  const seconds = Math.trunc(value / 1000)
  const hours = Math.trunc(seconds / 3600)
  const minutes = Math.trunc((seconds - hours * 3600) / 60)
  const pad = (number: number, width: number) => String(number).padStart(width, '0')
  return `${pad(hours, 4)}:${pad(minutes, 2)}:${pad(seconds % 60, 2)}`
}

/** 이름 표(`STAT_NAMES`) 안 자리 */
export const statNameOffsetOf = (cell: StatCell) => cell.nameIndex - STAT_NAME_FIRST_INDEX

/**
 * **숨은 쪽 열기 — 비밀 번호 "1212123"** (상태 30 갱신 `0x2b7a0`, 확정).
 *
 * 숫자 키('0'~'9')가 들어오면, 아직 안 열렸고(`[skin+0x2d0] == 0`) 센 수(`this+0x180`)가 6 이하일 때 글자를
 * 버퍼(`this+0x178`)에 붙이고 센 수를 1 늘린다. 센 수가 **7** 이 되는 순간마다 버퍼를 `0xcf358` "1212123" 과 견줘
 * 같으면 버퍼를 지우고 `[skin+0x2d0] = 1`, 다르면 0 으로 둔다. 센 수는 줄이지 않으니 **틀리면 다시 칠 수 없다**.
 *
 * 열리면 통계 탭의 쪽 넘기기가 0~7 여덟 쪽을 돈다(0x2ba32 · 0x2ba8c). 안 열렸으면 쪽 수 표 0xce8dc 의 2쪽뿐이라
 * 아이템·GP 칸(16~63)은 보이지 않는다. **쪽 번호 오른쪽 "/전체" 는 열려도 표 값 2 그대로다** (0x2e6c8).
 */
export const ANNALS_SECRET_CODE = '1212123'
export const UNLOCKED_STAT_PAGE_COUNT = 8

export interface SecretCodeState {
  readonly typed: string
  readonly count: number
  readonly isUnlocked: boolean
}

export const INITIAL_SECRET_CODE_STATE: SecretCodeState = { typed: '', count: 0, isUnlocked: false }

/**
 * 기록연감에 들어올 때 0x2407c — 입력 버퍼 this+0x178 만 지운다(0x2413c). 센 수와 열림 [skin+0x2d0] 은 그대로다 —
 * 그 둘은 메뉴 객체를 만들 때(0x234d4, 0x237f8)만 0 이 된다. 곧 틀린 일곱 자를 다 치면 메뉴를 다시 만들기 전까지 못 연다.
 */
export function enterAnnalsSecretCode(state: SecretCodeState): SecretCodeState {
  return { ...state, typed: '' }
}

export function typeSecretDigit(state: SecretCodeState, digit: string): SecretCodeState {
  if (state.isUnlocked || !/^[0-9]$/.test(digit)) return state
  const appended = state.count <= 6 ? { typed: state.typed + digit, count: state.count + 1 } : state
  if (appended.count !== 7) return { ...state, ...appended }
  return appended.typed === ANNALS_SECRET_CODE
    ? { typed: '', count: appended.count, isUnlocked: true }
    : { typed: appended.typed, count: appended.count, isUnlocked: false }
}

/**
 * 통계 탭 아래 합계 (0x2fafa~0x2fb90) — 쪽 0 은 `0x588d1` 플레이 시간 합, 쪽 6·7 은 `0x58801(…, 6)`·`(…, 7)`.
 * ⚠️ **원본 버그 그대로**: `0x58801` 은 인자 4(획득 합)·5(소모 합)만 더하고 그 밖은 0 이라 쪽 6·7 은 늘 **"0G"** 다.
 * 다른 쪽은 값 글이 없다. 쪽 0 의 시간 합은 웹이 저장하지 않아 비운다.
 */
export function statTotalTextOf(page: number): string | null {
  if (page === 6 || page === 7) return '0G'
  return null
}
