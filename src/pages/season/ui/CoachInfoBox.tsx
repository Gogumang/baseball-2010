import { useMemo } from 'react'
import { FrameSprite, MarkupText, PaintedRects } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { COACH_INFO_BOX, coachInfoBoxPaintsOf, coachInfoTextOf } from '@/pages/season/lib/coachInfoBox'

const MODE_UI = './sprites/mode_ui/frames'
const IMG_TEXT = './sprites/img_text/frames'

/** 코치채용 정보 상자 (0xaa6c~0xad78) — 배치 · 글은 `lib/coachInfoBox` 머리말 */
export function CoachInfoBox({ slot }: { readonly slot: number }) {
  const modeUiOrigins = useFrameOrigins(MODE_UI)
  const imgTextOrigins = useFrameOrigins(IMG_TEXT)
  const paints = useMemo(() => coachInfoBoxPaintsOf(), [])
  const { box, tab, title, text } = COACH_INFO_BOX
  return (
    <>
      <FrameSprite folder={MODE_UI} frame={tab.frame} origins={modeUiOrigins} x={tab.x} y={tab.y} />
      <FrameSprite folder={IMG_TEXT} frame={title.frame} origins={imgTextOrigins} x={title.x} y={title.y} />
      <PaintedRects x={box.x} y={box.y} width={box.width + 1} height={box.height + 1} paints={paints} testId="코치-정보상자" />
      <div data-testid="코치-정보글"
        style={{ position: 'absolute', left: text.x, top: text.y, width: text.width, color: '#FFFFFF', pointerEvents: 'none' }}>
        <MarkupText raw={coachInfoTextOf(slot)} />
      </div>
    </>
  )
}
