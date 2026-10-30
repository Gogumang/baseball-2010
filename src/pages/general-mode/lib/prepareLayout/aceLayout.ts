/** k = 2 마선수 고르기 (0x647b4~0x64d2e) — 격자 · 칸 그림 · 줄 딱지 · 흐린 칸 */
import type { GridOpenShape } from '@/shared/lib/gridOpen/gridOpen'

export const ACE_LAYOUT = {
  anchorA: { x: 58, y: 107 },
  anchorB: { x: 178, y: 96 },
  /**
   * `0x79ed5(격자, k==2 ? 7 : 8, 120, H/2 + 30 = 190, 칸너비 0xd1df8 = [40 ×5], 줄높이 40, 5열, 2줄, 가로틈 0, 세로틈 0x12, 1)`
   * (0x647f4~0x6482e, 직접 떴다). 네 번째 인자는 **첫 줄 위쪽 y** 다 (중심 아님 — S9 10절 정정 1).
   */
  grid: { columns: 5, rows: 2, cell: 40, centerX: 120, top: 190, hGap: 0, vGap: 0x12 },
  /**
   * 칸 그리기 — 0x7a005(격자, 1, 1, 1) 로 열림 애니 · 튕김 · 칸 바탕을 켠다(0x64832). 매 틱 0x7a571 이 (직접 떴다):
   * ```
   * 7a844  보이는 칸마다 0x6b7d5(gfx, x − 3, y − 3, 43, 43, 둥글기 1, RGB(0x30, 0x45, 0xcd))     ; 남색 둥근 바탕
   * 7b14c  종류 7: slt_frame 이미지 0(39×38) 을 (x, y)
   * 7b222  열렸으면 [skin+0xac](ace_icon) 이미지 칸번호 를 (x + 3, y + 2) — 흐릴 칸이면 효과 0xa(회색)
   *        잠겼으면 ace_icon 이미지 10 "?" 를 (x + 10, y + 5)
   * 7b408  커서 — 깜빡 ([격자+0x18] % 8 ≤ 4) 이고 열림 애니가 끝났으면 slt_frame 이미지 1(42×42) 을 (x − 2, y − 2)
   * ```
   */
  cellBack: { dx: -3, dy: -3, size: 43, color: '#3045CD' },
  cellImage: 0,
  icon: { dx: 3, dy: 2 },
  lockedIcon: { image: 10, dx: 10, dy: 5 },
  cursor: { image: 1, dx: -2, dy: -2 },
  /** 줄 딱지 — 둥근 판 #3045CD (17,175,51×10) + slt_frame 이미지 8 "PITCHER"(46×7) 을 (20,176) */
  rowTags: [
    { panel: { x: 17, y: 175, width: 51, height: 10 }, image: 8, imageAt: { x: 20, y: 176 }, label: 'PITCHER' },
    { panel: { x: 17, y: 233, width: 51, height: 10 }, image: 7, imageAt: { x: 20, y: 234 }, label: 'BATTER' },
  ],
  panelColor: '#3045CD',
  /** 잠긴 마선수 — 원 두 개 + slt_frame 이미지 114 "LOCK"(23×7) + 자물쇠 이미지 31 */
  lock: { labelImage: 114, iconImage: 31 },
  /** A 딱지 = img_text 50 "마타자" / 51 "마투수" (`[skin+0xd0]` 이 고른다) · B 딱지 159 "ABILITY" */
  tagFrames: { 마타자: 50, 마투수: 51, ability: 159 },
  /** 능력치 도형 `0x5aefd(…, B.x, B.y + 8, …, idx − 5, 30)` */
  abilityChart: { dx: 0, dy: 8, radius: 30 },
} as const

/**
 * 마선수 격자 칸 i 의 왼쪽 위 (그리기 `0x7a571`, S9 3-2·4-3 확정).
 *
 * 가로만 가운데를 맞추고 **세로는 `top` 을 그대로** 쓴다 — 줄 사이는 줄높이 40 + 세로틈 18 = 58.
 * 5열 화면이라 열별 보정 `0xd40b8 = [3,3,3,13,13]` 도 받는다 (종류 7·8 이 대상이다).
 * 열림 애니(위에서 한 줄씩 떨어짐 — `ACE_GRID_OPEN`)와 커서 튕김(2px 2틱)이 끝난 자리다 — 튕김은 화면이 `useGridCursorBounce`(0x7a7f6)로 고른 칸에 더한다.
 */
export function aceCellPositionOf(index: number) {
  const { columns, cell, centerX, top, hGap, vGap } = ACE_LAYOUT.grid
  const column = index % columns
  return {
    x: centerX - ((columns * cell + (columns - 1) * hGap) >> 1) + (cell + hGap) * column,
    y: top + (cell + vGap) * Math.floor(index / columns) - ACE_COLUMN_Y_OFFSETS[column],
  }
}

/**
 * 격자 열림 애니의 꼴 (`shared/lib/gridOpen`) — 줄높이 40 · 세로틈 0x12 · 가속 시프트 1(0x6481e `str r6,[sp,#0x18]`).
 * 시작 `0x7a005(격자, 1, 1, 1)`(0x64832~0x6483c) — 넷째 인자와 상관없이 늘 돈다.
 */
export const ACE_GRID_OPEN: GridOpenShape = {
  rows: ACE_LAYOUT.grid.rows,
  columns: ACE_LAYOUT.grid.columns,
  rowHeight: ACE_LAYOUT.grid.cell,
  rowGap: ACE_LAYOUT.grid.vGap,
  shift: 1,
}

/**
 * 격자 커서 깜빡임 — 그릴 때마다 [격자+0x18] 을 1 올리고 `% 8 ≤ 4` (0x7a632~0x7a64a).
 * 시작 0x7a005 가 [격자+0x18] = 0 으로 둔다(0x7a01e) — 격자를 지은 그림이 0 이다.
 */
export const isAceGridCursorOn = (drawCount: number): boolean => ((drawCount % 8) + 8) % 8 <= 4

/**
 * 흐린 칸(효과 0xa) — 0x7b1d0~0x7b220. [skin+0x105](레벨업 화면)이면 흐리지 않는다.
 * 단계 [skin+0xd0] 가 1(마투수 고르기)이면 마타자 칸(5~9)을, 0(마타자 고르기)이면 **고른 마투수가 아닌** 마투수 칸(0~4)을 흐린다.
 * ⚠️ 0 갈래의 "고른 마투수" 바이트([sp+0x15a] = [skin+0xbc..]+0xe 를 옮긴 것)는 칸 번호와 같은 뜻으로 읽었다(유력).
 */
export function isAceCellDimmed(cell: number, isPitcherPhase: boolean, chosenPitcherCell: number | null): boolean {
  if (isPitcherPhase) return cell > 4
  return cell <= 4 && cell !== chosenPitcherCell
}

/** 5열 화면 전용 열별 y 보정 `0xd40b8` (S9 4-3 확정) */
const ACE_COLUMN_Y_OFFSETS = [3, 3, 3, 13, 13] as const
