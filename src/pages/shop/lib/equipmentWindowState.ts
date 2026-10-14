import { EQUIPMENT_PART_COUNT, EQUIPMENT_VISIBLE_ROWS } from '@/pages/shop/lib/equipmentWindowLayout'

/**
 * 장비 창 키 — 창 키 0x819ad 의 종류 3·4 갈래(0x81a5e~0x81cc8)와 상점 키 0x13460 · 장비착용 키 0x17ad0 의 앞머리 (직접 떴다).
 *
 * 창은 목록 둘을 든다 — 부위 탭 `[창+0x198]`(4열 × 1줄, 꼴 0x30 = 가로·세로 감기, 0x81792~0x817a6)과
 * 장비 줄 `[창+0x19c]`(1열 × 줄 수, 꼴 0x30, 한 화면 5줄). 초점 `[창+0x1a8]` 이 0 이면 탭, 아니면 줄이다.
 * 상점 들어옴 0x115f4 는 장비 칸(커서 0)일 때 종류 3 · 초점 0 으로 연다.
 * ```
 * 초점 0 (탭)  −16 취소               → 상점 0x13b16 은 상태 110 · 장비착용 0x17aee 는 106 으로 (창 밖에서)
 *              −2 · '8' · −5 · '5'      → 줄이 하나라도 있으면([창+0x1b0] > 0) 초점 1 · 줄 커서 (0,0) · 윗줄 0 ·
 *                                         종류 3 이면 0x81938(창, 부위, 첫 줄 레벨) — 입혀 보기
 *              그 밖                  → 탭 목록 vt+0x18(키) 뒤 0x8146c(창, 부위) — 줄을 새로 짓고 커서 · 윗줄 0
 * 초점 1 (줄)  −16 취소               → 초점 0 · 줄 커서 (0,0) · 윗줄 0 · 0x81938(창, 부위, 기록의 니블 − 1)
 *              −5 · '5'               → 창 밖(0x13460 구매 / 0x17ad0 장착)
 *              그 밖                  → 줄 목록 vt+0x18(키) · 움직였으면([목록+0x25]) 0x81938(창, 부위, 그 줄 레벨)
 * ```
 * ⚠️ 미확인: 목록 객체(vtable 0xd2ea0 계열) 안을 안 떠서 탭 칸이 어떤 키로 움직이는지, 줄이 넘칠 때 윗줄을 어떻게 옮기는지는
 * 모른다. 웹은 ←→(·'4' '6') 로 탭을 감고, ↑↓(·'2' '8') 로 줄을 감으며, 커서가 화면 밖으로 나가면 그만큼만 윗줄을 옮긴다.
 */
export type EquipmentFocus = '탭' | '줄'

export interface EquipmentWindowState {
  readonly focus: EquipmentFocus
  readonly part: number
  /** 줄 커서 (0 부터) */
  readonly cursor: number
  /** 화면 맨 위 줄 */
  readonly top: number
}

export const INITIAL_EQUIPMENT_WINDOW: EquipmentWindowState = { focus: '탭', part: 0, cursor: 0, top: 0 }

export type EquipmentKey = '왼' | '오른' | '위' | '아래' | '확인' | '취소'

export type EquipmentKeyResult =
  | { readonly kind: '상태'; readonly state: EquipmentWindowState }
  /** 탭 초점의 취소 — 상점(110) · 장비착용(106) 으로 나간다 */
  | { readonly kind: '나가기' }
  /** 줄 초점의 확인 — 그 줄을 사거나 낀다 */
  | { readonly kind: '고르기'; readonly cursor: number }

/** 웹 키 → 원본 키. '2'·'4'·'5'·'6'·'8' 은 원본 숫자 키 */
export function equipmentKeyOf(key: string): EquipmentKey | null {
  if (key === 'ArrowLeft' || key === '4') return '왼'
  if (key === 'ArrowRight' || key === '6') return '오른'
  if (key === 'ArrowUp' || key === '2') return '위'
  if (key === 'ArrowDown' || key === '8') return '아래'
  if (key === 'Enter' || key === '5') return '확인'
  if (key === 'Escape') return '취소'
  return null
}

const wrap = (value: number, count: number) => (value + count) % count

/** 줄 커서를 감아 옮기고 윗줄을 맞춘다 (⚠️ 윗줄 규칙은 웹 근사) */
function movedRow(state: EquipmentWindowState, step: number, rowCount: number): EquipmentWindowState {
  if (rowCount === 0) return state
  const cursor = wrap(state.cursor + step, rowCount)
  const top = cursor < state.top
    ? cursor
    : cursor >= state.top + EQUIPMENT_VISIBLE_ROWS ? cursor - EQUIPMENT_VISIBLE_ROWS + 1 : state.top
  return { ...state, cursor, top }
}

export function equipmentWindowKeyOf(
  state: EquipmentWindowState, key: EquipmentKey, rowCount: number,
): EquipmentKeyResult {
  if (state.focus === '탭') {
    if (key === '취소') return { kind: '나가기' }
    if (key === '아래' || key === '확인') {
      return rowCount > 0
        ? { kind: '상태', state: { ...state, focus: '줄', cursor: 0, top: 0 } }
        : { kind: '상태', state }
    }
    if (key === '왼' || key === '오른') {
      const part = wrap(state.part + (key === '왼' ? -1 : 1), EQUIPMENT_PART_COUNT)
      return { kind: '상태', state: { ...state, part, cursor: 0, top: 0 } }
    }
    return { kind: '상태', state }
  }
  if (key === '취소') return { kind: '상태', state: { ...state, focus: '탭', cursor: 0, top: 0 } }
  if (key === '확인') return { kind: '고르기', cursor: state.cursor }
  if (key === '위' || key === '아래') return { kind: '상태', state: movedRow(state, key === '위' ? -1 : 1, rowCount) }
  return { kind: '상태', state }
}

/**
 * 입혀 보기 레벨 — 줄 초점이면 커서 줄의 레벨, 탭 초점이면 null(지금 낀 그대로).
 *
 * ⚠️ 원본 0x81938(창, 부위, 레벨) 은 `[창+0x148]` 레코드의 장비 니블을 **바로 고쳐 쓴다**. 그 칸은 장면 준비 0x1c410 이
 * `0x1fc75(app, 모드)` — 곧 **선수 레코드 자체**로 채운다. 그래서 원본은 줄을 훑기만 해도 그 장비가 끼워지고, 취소(0x81b52)는
 * 같은 레코드의 니블을 다시 읽어 넣으므로 되돌리지 못한다. 장비착용(0x17b3c)의 "이미 장착" 검사도 같은 니블을 본다.
 * 이것이 상점을 나갈 때·저장 때 어떻게 되는지는 아직 못 떴다 — 웹은 **그림에만** 입혀 보이고 커리어는 건드리지 않는다.
 */
export function previewLevelOf(state: EquipmentWindowState, levels: readonly number[]): number | null {
  if (state.focus !== '줄') return null
  return levels[state.cursor] ?? null
}
