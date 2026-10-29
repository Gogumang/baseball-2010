import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import type { ReactNode } from 'react'
import type { GridOpenDraw } from '@/shared/lib/gridOpen/gridOpen'
import { ACE_LAYOUT, isAceGridCursorOn } from '@/pages/general-mode/lib/prepareLayout'
import { ACE_PER_ROLE, ACE_PHASE, aceIndexOfCell, aceRoleOfCell } from '@/pages/general-mode/lib/generalModeSetup'
import type { AcePhase } from '@/pages/general-mode/lib/generalModeSetup'
import type { AnnalsDirection, AnnalsGridShape } from './otherSlices'

/**
 * 하위 상태 — `'고르기'` = 상태 21(일반모드 마선수, 갱신 0x29df8) · `'레벨업'` = 상태 28(스페셜 마선수 선택, 갱신 0x2af20) ·
 * `'코치'` = 시즌 선수단 0xd7 의 코치채용(`AceSelectScreenProps.mode`)
 */
export type AceSelectMode = '고르기' | '레벨업' | '코치'

export const SLT_IMAGE = assetUrl('./sprites/slt_frame')
/** [skin+0xac] — 격자 칸 그림 (0~9 마선수 얼굴 · 10 "?") */
export const ACE_ICON = assetUrl('./sprites/ace_icon')
export const IMG_TEXT_FRAME = assetUrl('./sprites/img_text/frames')

export const imageSrc = (folder: string, index: number) => `${folder}/${String(index).padStart(3, '0')}.png`

/** 잠긴 칸 글 — slt_frame 이미지 114 "LOCK" 을 대신하는 읽기용 이름 */
export const LOCK_LABEL = 'LOCK'

/** 0xb6415(기록, i, 1) 네 칸 — 기록 칸 차례(투수도 같은 네 칸에 제구 · 구속 · 변화 · 체력) */
export const abilityValuesOf = (ability: { readonly hit: number; readonly power: number; readonly defense: number; readonly run: number }) => [
  ability.hit,
  ability.power,
  ability.defense,
  ability.run,
]

/**
 * 격자 [메뉴+0x74] 의 꼴 — 진입이 `vt+0x1c(격자, 5열, 2줄, 숫자키 꼴 1, 꼴)` 로 짓는다(직접 떴다):
 * - 상태 21 진입 0x263f4(0x26408~0x26418): 꼴 **0x10** — 가로는 같은 줄 안에서 감고 세로는 끝에서 멈춘다.
 * - 상태 28 진입 0x262c8(0x262dc~0x262ea): 꼴 **0x20** — 세로는 감고 가로는 끝에서 멈춘다.
 * (진입 표 0xcf06c 는 상태 − 2 번째 칸: [19] 0x263f4 · [26] 0x262c8.)
 * - 시즌 0xd7(마선수 · 코치채용)의 격자 [장면+0x8c] 는 장면 생성자 0x3cc8~0x3ce6 이 꼴 **0x10** 으로 한 번 짓는다 — 고르기 꼴과 같다.
 */
const ACE_GRID_SHAPES: Readonly<Record<'고르기' | '레벨업', AnnalsGridShape>> = {
  고르기: { columns: ACE_LAYOUT.grid.columns, rows: ACE_LAYOUT.grid.rows, wrapsColumns: true, wrapsRows: false },
  레벨업: { columns: ACE_LAYOUT.grid.columns, rows: ACE_LAYOUT.grid.rows, wrapsColumns: false, wrapsRows: true },
}

export const aceGridShapeOf = (mode: AceSelectMode) => ACE_GRID_SHAPES[mode === '레벨업' ? '레벨업' : '고르기']

/** 칸의 마선수가 열렸는가 — 윗줄은 저장 +0x30..0x34(마투수), 아랫줄은 +0x35..0x39(마타자) */
export function isAceCellOpen(cell: number, openedAcePitcherIds: readonly number[] = [], openedAceBatterIds: readonly number[] = []): boolean {
  const opened = aceRoleOfCell(cell) === ACE_PHASE.마투수 ? openedAcePitcherIds : openedAceBatterIds
  return opened.includes(aceIndexOfCell(cell))
}

/** 0x7b408~0x7b42e — for i in 0..9: 전역 +0x30 + i == 0 이면 그만, 다 켜졌으면 0x62368(ui, 12, 0) */
export function isEveryAceOpen(openedAcePitcherIds: readonly number[] = [], openedAceBatterIds: readonly number[] = []): boolean {
  return Array.from({ length: ACE_PER_ROLE }, (_unused, index) => index).every(
    (index) => openedAcePitcherIds.includes(index) && openedAceBatterIds.includes(index),
  )
}

/**
 * **커서가 갈 수 있는 칸** — 격자 [메뉴+0x74] 는 진입(0x263f4 · 0x262c8)의 vt+0x1c 가 막힌 칸 표 [+0x28] 을 모두 1 로 채우고
 * 지우는 곳이 없어(직접 떴다) **잠긴 칸에도 커서가 간다** — 그 칸의 OK(0x29fbe~)가 `mgr[0x30 + 칸] == 0` 을 보고 오픈 힌트를 띄운다.
 * 상태 21 은 ↑ ↓ 를 격자에 안 넘겨(0x29e74~0x29e80) 단계의 줄 안에서만 다닌다. 상태 28 · 코치채용은 두 줄 모두.
 */
export const isAceCellReachable = (cell: number, mode: AceSelectMode, phase: AcePhase) => mode !== '고르기' || aceRoleOfCell(cell) === phase

/**
 * 키 → 격자 방향. 격자 vt+0x18(0x6c031, 숫자키 꼴 1)이 '4' '6' 을 ← →, '2' '8' 을 ↑ ↓ 로 바꾼다.
 * 상태 21 (0x29df8): ↑ ↓ '2' '8' 은 격자에 안 넘긴다(0x29e74~0x29e80) — 그 키를 받는 갈래도 없어 아무 일이 없다(`isAceDirectionPassed`).
 * 상태 28 (0x2af20): 모든 키를 격자에 넘긴다(0x2af68~0x2af72) — '2' '8' 도 ↑ ↓.
 * 코치채용(시즌 0xd7, [this+0x11c] = 2): 키 0xa248 의 0xa578~0xa586 이 모든 키를 격자 [this+0x8c] vt+0x18 에 넘긴다.
 *   그 격자는 장면 생성자 0x3cc8~0x3ce6 이 `vt+0x1c(5열, 2줄, 숫자키 꼴 1, 꼴 0x10)` 로 한 번 짓고 다시 안 짓는다.
 */
const KEY_DIRECTIONS: Readonly<Record<string, AnnalsDirection>> = {
  ArrowRight: 'right',
  '6': 'right',
  ArrowLeft: 'left',
  '4': 'left',
  ArrowDown: 'down',
  '8': 'down',
  ArrowUp: 'up',
  '2': 'up',
}

export const aceKeyDirectionOf = (key: string): AnnalsDirection | null => (Object.hasOwn(KEY_DIRECTIONS, key) ? KEY_DIRECTIONS[key]! : null)

/** 상태 21 의 ↑ ↓ 는 격자에 안 넘긴다 */
export const isAceDirectionPassed = (mode: AceSelectMode, direction: AnnalsDirection) =>
  mode !== '고르기' || (direction !== 'up' && direction !== 'down')

/** 마투수 단계는 윗줄에서, 마타자 단계는 아랫줄에서 커서가 시작한다 (원본이 OK 뒤 커서를 내린다) */
export const aceStartCursorOf = (phase: AcePhase) => (phase === ACE_PHASE.마투수 ? 0 : ACE_PER_ROLE)

/**
 * 격자 커서 칸이 그려지는가 — 깜빡임 [격자+0x18] 은 시작 0x7a005 가 0 으로 두고(0x7a01e) 그릴 때마다 끝에서 +1(0x7b490) → 본문 몇째
 * 그림인가와 같다. 커서 칸 그리기 0x7b3a0 은 열림 애니가 끝났고([격자+9]) 깜빡임이 켜졌을 때만 돈다(0x7b3a2 · 0x7b3c6)
 */
export const isAceGridCursorShownOf = (gridOpen: GridOpenDraw | null) =>
  gridOpen !== null && gridOpen.state.isDone && isAceGridCursorOn(gridOpen.blink)

/** 팝업 · 창(오픈 힌트 · G 부족 · 최고 레벨 · 레벨업 · 부르는 쪽 팝업)이 떠 있으면 격자는 키를 받지 않는다 — MessageBox 가 답을 가져간다 */
export const isAceGridBlockedOf = (
  hintCell: number | null,
  isShortageOpen: boolean,
  isMaxLevelOpen: boolean,
  levelUpCell: number | null,
  overlay: ReactNode,
) => hintCell !== null || isShortageOpen || isMaxLevelOpen || levelUpCell !== null || (overlay !== undefined && overlay !== null && overlay !== false)

/** 바닥 0x205 = 가운데 "0레벨업" + 되돌아가기 · 코치채용(this+0x11c == 2)은 0x54d95(skin, 4, 5) — 되돌아가기만 (0xad94~0xada0) */
export const aceFooterOf = (mode: AceSelectMode) => (mode === '코치' ? 5 : 0x205)
