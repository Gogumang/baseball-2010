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
 *
 * **목록 객체 (vtable 0xd2ea0, 직접 떴다)** — 만들기 0x81766~0x817c6: 탭 vt+0x10(목록, 4, 1, 숫자키 꼴 1, 0x30)(구장 종류 4 는 3 칸) ·
 * 줄 vt+0x1c(목록, 1, 11, 1, 0x30)(종류 4 는 7) · 줄 [+0x34] = 1 · [+0x38] = 5. 키 vt+0x18 = 0x6c299 → 0x6c521 → 0x6c031 → vt+0x20.
 * - 숫자키 꼴 1(0x6c096, 표 0xd2e7c): '2' → −1(↑) · '4' → −3(←) · '6' → −4(→) · '8' → −2(↓) · '5' → −5(OK) — 웹 `equipmentKeyOf` 와 같다.
 * - 꼴 0x30 = 0x10 가로 감기 · 0x20 세로 감기(F 문서 격자). 그래서 탭(4 × 1)은 ←→ 로 감기고 ↑↓ 는 제자리, 줄(1 × n)은 ↑↓ 로
 *   감기고 ←→ 는 제자리(움직임 [목록+0x25] 없음 → 입혀 보기도 없음)다.
 * - 윗줄 vt+0x20 = 0x6c2bd: 줄 r 이 [윗줄, 윗줄 + 5) 밖이면 r > 윗줄 이면 윗줄 = r − 5 + 1, 아니면 윗줄 = r (열도 같은 식) —
 *   웹 `movedRow` 와 같다(감겨서 0 으로 가면 윗줄 0, 끝으로 가면 끝 − 4).
 * 키는 늘 받는다(확정): 장비 창은 열고 닫는 연출이 없다 — 창 그리기 0x8453c 는 종류 3 이면 0x83378 을 바로 부르고 그 안에 틱 칸은
 * 깜빡임(틱 % 10)뿐이다. 창 키 0x819ac · 상점 키 0x13460 · 장비착용 키 0x17ad0 · 시즌 0xdc 키 0x957c 앞머리는 창 종류 [창+0x1a4] ·
 * 초점 [창+0x1a8] 만 보고 [skin+0xe4](목록 펼침 끝) 같은 막음 칸을 읽지 않는다. 장면 쪽 막음은 팝업 · 키 깃발뿐이다(나리 0x1d06a).
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

/** 줄 커서를 감아 옮기고 윗줄을 맞춘다 — 목록 0x6c2bd 그대로 */
function movedRow(state: EquipmentWindowState, step: number, rowCount: number): EquipmentWindowState {
  if (rowCount === 0) return state
  const cursor = wrap(state.cursor + step, rowCount)
  const top = cursor < state.top ? cursor : cursor >= state.top + EQUIPMENT_VISIBLE_ROWS ? cursor - EQUIPMENT_VISIBLE_ROWS + 1 : state.top
  return { ...state, cursor, top }
}

export function equipmentWindowKeyOf(state: EquipmentWindowState, key: EquipmentKey, rowCount: number): EquipmentKeyResult {
  if (state.focus === '탭') {
    if (key === '취소') return { kind: '나가기' }
    if (key === '아래' || key === '확인') {
      return rowCount > 0 ? { kind: '상태', state: { ...state, focus: '줄', cursor: 0, top: 0 } } : { kind: '상태', state }
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
 * **입혀 보기는 사본에만 남는다 — 커리어 · 저장은 그대로다 (직접 떴다, 2026-10-14).**
 * 0x81938(창, 부위, 레벨) 은 `[창+0x148]` 기록의 장비 니블(+0x19 + 부위>>1, 부위 짝수면 윗니블)을 레벨 + 1 로 고쳐 쓰고
 * 그림 [창+0x16c] 의 +0x3e + 부위 에 레벨을 넣어 vt+0x14 로 그 장비를 싣는다. `[창+0x148]` 은 장면 준비 0x1c410 이
 * `0x1fc75(app, 모드)`(선수 기록 자체)로 채우지만, **상점 111 진입 0x115f4(장비 칸) · 장비착용 121 진입 0x11594 가 부르는 0x108f8 이
 * 새 0x30 바이트 객체 [장면+0x114] 에 그 기록을 0x1400408(memcpy) 로 복사해 `[창+0x148]` 을 그 사본으로 바꾼다**(0x1097c~0x109c2).
 * - 취소(0x81b52)는 `0x1fc75` 의 **진짜** 니블 − 1 을 읽어 0x81938 로 사본에 다시 넣는다 → 그림이 지금 낀 장비로 돌아온다.
 * - 목록의 장착 막대(0x83954) · 장비착용 "이미 장착"(0x17b36) · 구매 확정 0x14a74 는 모두 `0x1fc75` 진짜 기록을 본다.
 * - 사본을 진짜 기록에 되쓰는 곳은 없다 — 110 취소(0x11478 의 0x114c4~0x114e2)는 그림과 사본을 지우기만 하고, 0x1400408 을
 *   부르는 나리 장면 함수는 0x108f8 · 0x14a74(글) · 0x17f5c · 0x1b768 뿐이다.
 * - 같은 사본을 기본정보 카드 레이더(0x7ba44)도 읽는다 — 입혀 본 장비가 실효값에 든다(`BasicInfoCard` · `PitcherBasicInfoCard`).
 * 그래서 웹도 그림 · 레이더에만 입혀 보이고 커리어는 건드리지 않는다. (r49 가 본 "훑기 = 실제 장착"은 0x1c410 만 보고
 * 0x108f8 의 사본 교체를 놓친 것이었다.)
 */
export function previewLevelOf(state: EquipmentWindowState, levels: readonly number[]): number | null {
  if (state.focus !== '줄') return null
  return levels[state.cursor] ?? null
}
