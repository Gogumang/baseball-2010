import { useMemo } from 'react'
import { FrameSprite } from '@/shared/ui/FrameSprite/FrameSprite'
import { PaintedRects } from '@/shared/ui/CommonPanel/CommonPanel'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { roundFillPaintsOf } from '@/shared/lib/commonPanel/commonPanel'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { inputModeLayoutOf } from '@/shared/ui/InputMethodText/inputModeLayout'
import type { Box } from '@/shared/ui/InputMethodText/inputModeLayout'

const MODE_UI = assetUrl('./sprites/mode_ui/frames')
/** mode_ui 24 화살 — 크기는 `inputModeLayout` */
const ARROW_FRAME = 24
/** 입력 방식 칸 0xba0bd 색 RGB(0x2E, 0x46, 0x94) — 0x16160 · 0x1616a · 0x16176 */
export const INPUT_MODE_COLOR = '#2E4694'

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
