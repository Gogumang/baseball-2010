import { roundFillPaintsOf } from '@/shared/lib/commonPanel/commonPanel'
import type { PanelPaint } from '@/shared/lib/commonPanel/commonPanel'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { coachFeeOf, coachRequiredPopularityOf } from '@/entities/season-mode/model/seasonCoach'
import { fillModeText, seasonMoneyTextOf } from '@/widgets/season/lib/seasonText'

/**
 * **코치채용 정보 상자** — 선수단 그림 0xaa24 가 `[this+0x11c] == 2`(코치채용)일 때만 공용 목록 k 10 뒤에 그린다
 * (0xaa6c~0xad78, r263 직접 뜸). 그 뒤 머리띠 0x54d95(skin, 4, 5).
 * ```
 * aa6c  R  = (W/2 − 14, H/2 − 0x60, 0x80, 0x4b) = (106, 64, 128, 75)
 *       R2 = (R.x + 3, H/2 − 0x5d, R.w − 5, R.h − 5) = (109, 67, 123, 70)
 * aacc  탭 = mode_ui([this+0xc8]) 프레임 8 (49×15) → 0xba19d(탭, R.x + (R.w − 탭w)/2, R.y − 탭h + 1)        = (145, 50)
 * ab0a  img_text 159 "ABILITY" → 0xba19d(글, 탭 x + 5, R.y − 탭h + 6)                                      = (150, 55)
 * ab5c  0xba0bd(R, 둥글기 1, #395DCE)                     ; 둥근 칠 (w+1)×(h+1), 네 모서리 점은 빈다
 * ab7c  0xb9f75(R2, #041D53)                              ; 안쪽 네모 칠
 * ab98  선 #4A7DF7 (R2.x, B)–(R2.x + 0x43, B)             ; B = R2.y + R2.h = 137
 * abc2  i = 0..5: 점 #4A7DF7 (R2.x + 0x43 + i, B − i) · 선 #395DCE (R2.x + 0x44 + i, B − i)–(R2.x + R2.w, B − i)
 * ac2e  선 #4A7DF7 (R2.x + 0x49, B − 6)–(R2.x + R2.w − 1, B − 6)   ; 오른쪽 아래가 비스듬히 깎인 꼴
 * ac5e  글 = StrMODE[0x95 + 칸] + "!N"(0xcbbe0) + "!cFFFFFF"(0xcc260)
 *          + sprintf(StrMODE[159] "계약금 : %s", 0x55cf5(표 0xcbc24[칸] × 1000)) + "!N"
 *          + sprintf(StrMODE[160] "필요 인기도 : %d", 표 0xcbc10[칸])
 * ad3e  R2.x += 3 · R2.y += 8 → 0xba411(R2, 글, 정렬 0x11)   ; 왼쪽 위 (112, 75)
 * ```
 * 칸 = 격자 [this+0x8c] 커서(줄 × 열수 + 열) — 잠긴 칸이어도 그린다(가드 없음).
 * 선(0x6a904)은 두 끝을 다 칠한다 — 칠 칸은 R 왼쪽 위를 (0, 0) 으로 둔 1px 높이 사각형이다.
 */
export const COACH_INFO_BOX = {
  box: { x: 106, y: 64, width: 128, height: 75 },
  inner: { x: 109, y: 67, width: 123, height: 70 },
  tab: { frame: 8, x: 145, y: 50 },
  title: { frame: 159, x: 150, y: 55 },
  text: { x: 112, y: 75, width: 123 },
  colors: { outer: '#395DCE', inner: '#041D53', edge: '#4A7DF7' },
} as const

/** 0xab5c~0xac5a 의 칠 목록 — R 왼쪽 위 (0, 0), (R.w + 1) × (R.h + 1) */
export function coachInfoBoxPaintsOf(): PanelPaint[] {
  const { box, inner, colors } = COACH_INFO_BOX
  const ix = inner.x - box.x
  const iy = inner.y - box.y
  const bottom = iy + inner.height
  const right = ix + inner.width
  const line = (x1: number, x2: number, y: number, color: string): PanelPaint =>
    ({ x: x1, y, width: x2 - x1 + 1, height: 1, color })
  const paints: PanelPaint[] = [
    ...roundFillPaintsOf(box.width, box.height, colors.outer),
    { x: ix, y: iy, width: inner.width, height: inner.height, color: colors.inner },
    line(ix, ix + 0x43, bottom, colors.edge),
  ]
  for (let i = 0; i <= 5; i += 1) {
    paints.push({ x: ix + 0x43 + i, y: bottom - i, width: 1, height: 1, color: colors.edge })
    paints.push(line(ix + 0x44 + i, right, bottom - i, colors.outer))
  }
  paints.push(line(ix + 0x49, right - 1, bottom - 6, colors.edge))
  return paints
}

/** 0xac5e~0xad3a 의 글 — 칸의 코치 효과 · 계약금 · 필요 인기도 (마크업 원문 그대로) */
export function coachInfoTextOf(slot: number): string {
  const effect = ORIGINAL_MODE_TEXT[0x95 + slot] ?? ''
  const fee = seasonMoneyTextOf(coachFeeOf(slot) ?? 0)
  const fee159 = fillModeText(ORIGINAL_MODE_TEXT[159] ?? '', fee)
  const popularity160 = fillModeText(ORIGINAL_MODE_TEXT[160] ?? '', coachRequiredPopularityOf(slot) ?? 0)
  return `${effect}!N!cFFFFFF${fee159}!N${popularity160}`
}
