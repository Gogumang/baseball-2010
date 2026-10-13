/**
 * **두 칸 고르기 팝업 0x80 — 시즌 기록순위(그리기 0xf334 · 키 0xf5d4)와 나리 기록실(그리기 0x19448 · 키 0x196ec)이 같은 꼴**
 * (2026-10-09 두 함수를 명령 단위로 견줬다 — 다른 것은 아래 셋뿐이다):
 * ```
 *              시즌 0xf334                    나리 0x19448
 * 글 객체      [장면+0xdc]                    [장면+0x144]
 * 그림 객체    [장면+0xc0]                    [장면+0xe0]
 * 고른 칸      [장면+0x16c] ≠ 0 → 칸 0         [장면+0x166] == 0 → 칸 0
 * 칸 글        +0x620(392) · +0x624(393)       +0x1a8(106) · +0x5a0(360)
 * ```
 * 그 밖은 같다 — 제목 StrMODE[74] (0x702b5(글, 0x4a) → 0xba269, 흰 글, (W/2 − 0x54, H/2 − 0x28)) ·
 * 칸 0 = (W/2 − 0x38, H/2, 0x20, 0x20) 프레임 6 · 칸 1 = (W/2 + 0x18, H/2, 0x20, 0x20) 프레임 10 을 **0x858fd(그림 객체, 칸, 프레임, 팔레트)** 로:
 * ```
 * 0x913e5([그림+0x30], 팔레트)                     ; 고른 칸 0(mpl 첫 벌) · 아닌 칸 −1(pzx 제 팔레트)
 * 0xb9d35([[[그림+0x2c]+8]+8][프레임], 칸, 꼴 0x22) ; 0xb9c5c: x += (w − iw)/2 몫 + 나머지 · y += (h − ih)/2 몫
 * ```
 * 그림 묶음 [그림+0x2c] · [그림+0x30] 은 0x7dfac 가 비었으면 싣는다 — `ui/mode_icon.pzx` · 팔레트 `ui/mode_icon.mpl`.
 * 33×33 아이콘이라 칸보다 1 넓다 → (칸 x − 1, 칸 y).
 * 칸 글 img_text 는 (칸 x + (0x20 − 글 폭)/2 몫, 칸 y + 0x20 + 4) — 고른 칸은 효과 0 그대로, 아닌 칸은 효과 0xb 단색 RGB(0xb2, 0xb2, 0xb2)
 * (0xf482~0xf4a0 · 0xf57c~0xf59a). 칸 테두리는 없다.
 */
export const RECORD_PICK_CELLS: readonly { readonly x: number; readonly y: number; readonly iconFrame: number }[] = [
  { x: 120 - 0x38, y: 160, iconFrame: 6 },
  { x: 120 + 0x18, y: 160, iconFrame: 10 },
]
export const RECORD_PICK_CELL_SIZE = 0x20
/** 칸 글 아래 틈 (0xf420 · 0x19534 `adds r7, r3, #4`) */
export const RECORD_PICK_LABEL_GAP = 4
/** 아닌 칸 글 단색 — 0x1400748(0xb2, 0xb2, 0xb2) · 효과 0xb */
export const RECORD_PICK_DIM_LABEL_COLOR = '#b2b2b2'
/** 팝업 제목 StrMODE[74] "!C보고 싶은 기록을!N선택해주세요" (0xf362 · 0x1947a `movs r1, #0x4a`) */
export const RECORD_PICK_TITLE_ID = 74

/** 0xb9c5c 꼴 0x22 — 가로: (칸 − 그림)/2 몫 + 나머지(C 나눗셈) · 세로: (칸 − 그림)/2 몫 */
export function recordPickIconOffsetOf(imageWidth: number, imageHeight: number): { readonly x: number; readonly y: number } {
  const dx = RECORD_PICK_CELL_SIZE - imageWidth
  const dy = RECORD_PICK_CELL_SIZE - imageHeight
  // `| 0` 은 C 나눗셈처럼 0 쪽으로 자른다(−0 도 0 으로)
  return { x: ((dx / 2) | 0) + (dx % 2), y: (dy / 2) | 0 }
}

/** 칸 글 x — 0xf406~0xf40e · 0x19518~0x19526 `(칸 폭 − 글 폭) / 2` 몫 */
export function recordPickLabelXOf(labelWidth: number): number {
  return ((RECORD_PICK_CELL_SIZE - labelWidth) / 2) | 0
}
