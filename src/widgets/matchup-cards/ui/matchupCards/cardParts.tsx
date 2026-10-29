import type { CSSProperties } from 'react'
import {
  CARD_COLORS,
  GAME_UI_FOLDER,
  GAME_UI_FRAMES,
  NUM_FOLDER,
  cardBackgroundOf,
  roundFillRectsOf,
} from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import type { CardBox, FillRect, FrameSize, NumberGlyph, Placed } from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import * as styles from '@/widgets/matchup-cards/ui/MatchupCards.css'

const pad = (frame: number) => String(frame).padStart(3, '0')

export function Fill({ rect }: { readonly rect: FillRect }) {
  // 0xba0bc 의 둥근 칠(둥글기 > 0)은 0x6b7d4 가 사각 칠 하나와 선 넷으로 그린다 (`roundFillRectsOf`)
  const parts = rect.round > 0 ? roundFillRectsOf(rect) : [rect]
  return (
    <>
      {parts.map((part, index) => (
        <div
          key={index}
          className={styles.fill}
          style={{
            left: part.x,
            top: part.y,
            width: Math.max(0, part.width),
            height: Math.max(0, part.height),
            background: rect.color,
          }}
          data-testid="판칠"
        />
      ))}
    </>
  )
}

export function FrameImage({
  folder,
  frame,
  size,
  at,
  testId,
  style,
}: {
  readonly folder: string
  readonly frame: number
  readonly size: FrameSize
  readonly at: Placed
  readonly testId: string
  readonly style?: CSSProperties
}) {
  return (
    <img
      className={styles.sprite}
      style={{ left: at.x + size.x, top: at.y + size.y, ...style }}
      src={`${folder}/${pad(frame)}.png`}
      alt=""
      data-testid={testId}
      data-frame={frame}
    />
  )
}

export function Glyphs({ glyphs, testId }: { readonly glyphs: readonly NumberGlyph[]; readonly testId: string }) {
  return (
    <>
      {glyphs.map((glyph, index) => (
        <img
          key={index}
          className={styles.sprite}
          style={{ left: glyph.x, top: glyph.y }}
          src={`${NUM_FOLDER}/${pad(glyph.image)}.png`}
          alt=""
          data-testid={testId}
          data-image={glyph.image}
        />
      ))}
    </>
  )
}

export function NameText({ name, cardBox, origin }: { readonly name: string; readonly cardBox: CardBox; readonly origin: Placed }) {
  return (
    <span
      className={styles.name}
      style={{
        left: origin.x + cardBox.x,
        top: origin.y + cardBox.y,
        width: cardBox.width,
        height: cardBox.height,
        color: CARD_COLORS.name,
      }}
      data-testid="이름"
    >
      {name}
    </span>
  )
}

/** 판 바탕 — 둥근 칠 두 겹 + game_ui 프레임 (0x44a76~0x44b02) */
export function CardBase({ frame, origin }: { readonly frame: number; readonly origin: Placed }) {
  return (
    <>
      {cardBackgroundOf(origin).map((rect, index) => (
        <Fill key={index} rect={rect} />
      ))}
      <FrameImage folder={GAME_UI_FOLDER} frame={frame} size={GAME_UI_FRAMES[frame]} at={origin} testId="판" />
    </>
  )
}
