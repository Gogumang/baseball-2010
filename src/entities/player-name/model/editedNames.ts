import { MAXIMUM_NAME_BYTES, nameByteLengthOf } from '@/entities/career/model/playerCareer'

/**
 * **에디트 이름표** — 스페셜 에디트(메인 메뉴 상태 29)가 고친 선수 이름 (R11 1c 확정).
 *
 * 원본은 앱 데이터 save[+0xac] **+0x178** 에 9 바이트(8 + NUL) 칸을 투수 80 · 타자 120 = 200칸,
 * 합계 0x708 = 1800 바이트로 둔다. 칸은 **선수 id**(레코드 +0)로 걸린다:
 * ```
 * aa458  표칸(표, id, 투수?)       ; 투수: id ≤ 0x4f → 표 + id×9 · 그 밖 NULL
 *                                   ; 타자: id ≤ 0x77 → 표 + 0x2d0 + id×9 · 그 밖 NULL
 * aa488  고친이름있나(표, id, 투수?) = 표칸 ≠ NULL && strlen ≠ 0
 * aa4ac  쓰기(표, id, 글, 투수?)    ; n = min(strlen(글), 8) 바이트 복사 + NUL (범위 검사 없음)
 * aa534  비우기(표)                 ; memset(표, 0, 0x708) — 에디트 초기화 0x204c1
 * ```
 * 웹은 칸 하나를 문자열 하나로 둔다 — 빈 문자열이 "NUL 로 시작하는 칸"(고친 이름 없음)이다.
 */
export const EDITED_PITCHER_SLOTS = 0x50
export const EDITED_BATTER_SLOTS = 0x78
/** 칸에 들어가는 글 길이 — CP949 8 바이트 (0xaa4ad `min(strlen, 8)`) */
export const EDITED_NAME_BYTES = MAXIMUM_NAME_BYTES

export interface EditedNameTable {
  /** 투수 id 0~0x4f 칸 */
  readonly pitchers: readonly string[]
  /** 타자 id 0~0x77 칸 */
  readonly batters: readonly string[]
}

const emptySlots = (count: number): readonly string[] => Array.from({ length: count }, () => '')

/** 새 저장 · 에디트 초기화(0x204c1 → 0xaa534) 뒤의 표 — 200칸 모두 빈 칸 */
export const EMPTY_EDITED_NAMES: EditedNameTable = {
  pitchers: emptySlots(EDITED_PITCHER_SLOTS),
  batters: emptySlots(EDITED_BATTER_SLOTS),
}

const slotsOf = (table: EditedNameTable, isPitcher: boolean) => (isPitcher ? table.pitchers : table.batters)
const slotCountOf = (isPitcher: boolean) => (isPitcher ? EDITED_PITCHER_SLOTS : EDITED_BATTER_SLOTS)
const isSlotId = (id: number, isPitcher: boolean) => Number.isInteger(id) && id >= 0 && id < slotCountOf(isPitcher)

/**
 * 고친 이름 — `0xaa458` 로 칸을 찾고 `0xb62c0` 처럼 **빈 칸이면 없음**(null).
 * 범위 밖 id(투수 > 0x4f · 타자 > 0x77 — 국가대표·외인구단·마선수·명예·나리 선수)는 늘 null 이다.
 */
export function editedNameOf(table: EditedNameTable, id: number, isPitcher: boolean): string | null {
  if (!isSlotId(id, isPitcher)) return null
  const name = slotsOf(table, isPitcher)[id] ?? ''
  return name.length > 0 ? name : null
}

/** 칸에 넣을 글 — 0xaa4ad 의 `min(strlen, 8)` 바이트. 웹은 글자를 반으로 자르지 않고 8 바이트 안에서 끊는다 */
export function clipEditedName(name: string): string {
  let clipped = ''
  for (const character of name) {
    if (nameByteLengthOf(clipped + character) > EDITED_NAME_BYTES) break
    clipped += character
  }
  return clipped
}

/**
 * 이름 쓰기 `0xaa4ad(표, id, 글, 투수?)`. 원본은 쓰기에 범위 검사가 없지만 고칠 수 있는 선수가
 * 팀 0~9 기본 명단(투수 id 0~0x4f · 타자 id 0~0x77)뿐이라 범위 밖 쓰기는 일어나지 않는다 — 웹은 그냥 무시한다.
 */
export function withEditedName(table: EditedNameTable, id: number, isPitcher: boolean, name: string): EditedNameTable {
  if (!isSlotId(id, isPitcher)) return table
  const slots = [...slotsOf(table, isPitcher)]
  slots[id] = clipEditedName(name)
  return isPitcher ? { ...table, pitchers: slots } : { ...table, batters: slots }
}

/** 에디트 초기화 `0x204c1` = `memset(표, 0, 0x708)` — 다른 데이터(팀·능력치·G)는 안 건드린다 */
export function clearEditedNames(): EditedNameTable {
  return EMPTY_EDITED_NAMES
}

/** 저장 읽기 — 칸이 없던 옛 저장(에디트가 없던 웹판)은 빈 표다. 이상한 칸은 빈 칸으로 */
export function normalizeEditedNames(raw: unknown): EditedNameTable {
  const source = (raw ?? {}) as { pitchers?: unknown; batters?: unknown }
  const slots = (value: unknown, count: number): readonly string[] => {
    const list = Array.isArray(value) ? value : []
    return Array.from({ length: count }, (_, index) => {
      const name = list[index] as unknown
      return typeof name === 'string' ? clipEditedName(name) : ''
    })
  }
  return {
    pitchers: slots(source.pitchers, EDITED_PITCHER_SLOTS),
    batters: slots(source.batters, EDITED_BATTER_SLOTS),
  }
}
