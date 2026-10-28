import { useMemo } from 'react'
import { FrameSprite } from '@/shared/ui/FrameSprite/FrameSprite'
import { PaintedRects } from '@/shared/ui/CommonPanel/CommonPanel'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { roundFillPaintsOf } from '@/shared/lib/commonPanel/commonPanel'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

type Box = { readonly x: number; readonly y: number; readonly width: number; readonly height: number }

const MODE_UI = assetUrl('./sprites/mode_ui/frames')
/** mode_ui 24 화살 (5×8) — 폭은 0x161c0 · 0x161de 의 `ldrh [그림+0x12]` */
const ARROW_FRAME = 24
const ARROW_WIDTH = 5
const ARROW_HEIGHT = 8
/** 입력 방식 칸 0xba0bd 색 RGB(0x2E, 0x46, 0x94) — 0x16160 · 0x1616a · 0x16176 */
export const INPUT_MODE_COLOR = '#2E4694'

/**
 * 나리 등록 그리기 **0x15f34** 의 입력 방식 칸 — 타자(0x66, [장면+0xcc] == 4) · 투수 등록이 같은 함수라 둘 다 그린다.
 *
 * 원본 (0x160e2~0x161f4, 직접 떴다):
 * ```
 * 줄 == 0 (0x160e8~0x160fa: [this+0x74] 목록 커서 = +0xc + +0x10 × +0x14) 일 때만:
 *   R = 0x94a65(mode_ui [0xcc]==4 ? 2 : 1, 0, 박스 2) = (60,184,81,15) · R.y += R.h + 2      ; 0x16110~0x16126 → (60,201,81,15)
 *   0x677d5(입력기, R.x + 2, R.y + 3, …)                                                   ; 이름 글 (InputMethodText)
 *   M = (R.x + R.w − 20, R.y + 1, 14, 14)                                                 ; 0x1615c~0x16174
 *   0xba0bd(M, 둥글기 1, RGB(0x2E,0x46,0x94))                                              ; 0x1618e
 *   0x676f9(입력기, M.x + 2, M.y + 2, 글꼴, RGB(255,255,0), 0)                              ; 0x161b8 입력 방식 글
 *   0xb9e05(mode_ui 24, M, 정렬 0x21, ox −폭)                                              ; 0x161d4
 *   0xb9e05(mode_ui 24, M, 정렬 0x24, 효과 0x11 뒤집기, ox 2 × 폭)                          ; 0x161f0
 * ```
 * mode_ui 프레임 1 · 2 박스 2 가 모두 (60,184,81,15) 라 타자 · 투수 모두 M = (121,202,14,14) 다.
 */
export function inputModeLayoutOf(nameBox: Box) {
  const box: Box = { x: nameBox.x + nameBox.width - 20, y: nameBox.y + 1, width: 14, height: 14 }
  // 정렬 0x21 · 0x24 의 세로 가운데 (0xb9e05) — (h − 그림 높이) / 2 에 나머지를 더한다
  const d = box.height - ARROW_HEIGHT
  const top = box.y + Math.trunc(d / 2) + (d % 2)
  return {
    box,
    arrows: {
      left: { x: box.x - ARROW_WIDTH, y: top },
      right: { x: box.x + box.width - ARROW_WIDTH + 2 * ARROW_WIDTH, y: top },
    },
  }
}

/**
 * 입력 방식 칸 칠 · 화살 (0x15f34 줄 0 갈래). 부르는 쪽이 "이름 줄일 때" 만 그린다.
 * ⚠️ 입력 방식 글 0x676f9 는 웹 글 칸(`InputMethodText` 의 `<input>`)에 폰 입력 방식(A/a/1/가)이 없어 옮기지 않았다.
 */
export function InputModeBox({ nameBox }: { readonly nameBox: Box }) {
  const origins = useFrameOrigins(MODE_UI)
  const { box, arrows } = inputModeLayoutOf(nameBox)
  // 둥근 칠 0xba0bd 는 (w + 1) × (h + 1) 을 덮는다
  const paints = useMemo(() => roundFillPaintsOf(box.width, box.height, INPUT_MODE_COLOR), [box.width, box.height])
  return (
    <>
      <PaintedRects x={box.x} y={box.y} width={box.width + 1} height={box.height + 1} paints={paints} testId="입력방식칸" />
      <FrameSprite folder={MODE_UI} frame={ARROW_FRAME} origins={origins} x={arrows.left.x} y={arrows.left.y} />
      <FrameSprite folder={MODE_UI} frame={ARROW_FRAME} origins={origins} x={arrows.right.x} y={arrows.right.y} style={{ transform: 'scaleX(-1)' }} />
    </>
  )
}
