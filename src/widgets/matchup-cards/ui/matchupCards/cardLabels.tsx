import type { CSSProperties } from 'react'
import { GAME_UI_FOLDER, GAME_UI_FRAMES, IMG_TEXT_FOLDER, IMG_TEXT_FRAMES, framePlacementOf } from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import type { CardBox, Placed } from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import { FrameImage } from '@/widgets/matchup-cards/ui/matchupCards/cardParts'

/**
 * img_text 글자를 박스에 (0xb9e8c) — 크기를 모르는 프레임은 그리지 않는다.
 * `paletteStyle` 은 그 자리의 img_text 팔레트(`useImgTextPalettes().styleOf`) — 박스 1 PLAYER/COM 은 팔레트 4
 * (0x44b26 · 0x451f8), 나머지는 0 이다(0x44bf0 · 0x452c8 에서 0 으로 돌린 뒤 보직 · 수비 글자를 찍는다).
 */
export function Label({
  frame,
  cardBox,
  anchor,
  origin,
  testId,
  paletteStyle,
}: {
  readonly frame: number
  readonly cardBox: CardBox
  readonly anchor: number
  readonly origin: Placed
  readonly testId: string
  readonly paletteStyle?: CSSProperties
}) {
  const size = IMG_TEXT_FRAMES[frame]
  if (size === undefined) return null
  return (
    <FrameImage
      folder={IMG_TEXT_FOLDER}
      frame={frame}
      size={size}
      at={framePlacementOf(cardBox, size, anchor, origin)}
      testId={testId}
      style={paletteStyle}
    />
  )
}

/** game_ui 칸을 박스에 (0xb9e8c, 정렬 0x11) */
export function Chip({
  frame,
  cardBox,
  origin,
  testId,
}: {
  readonly frame: number
  readonly cardBox: CardBox
  readonly origin: Placed
  readonly testId: string
}) {
  const size = GAME_UI_FRAMES[frame]
  if (size === undefined) return null
  return <FrameImage folder={GAME_UI_FOLDER} frame={frame} size={size} at={framePlacementOf(cardBox, size, 0x11, origin)} testId={testId} />
}
