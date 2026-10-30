import { useId } from 'react'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { FrameSprite, RoundBox, SolidStamp } from '@/shared/ui'
import { useImgTextPalette3 } from '@/shared/ui/ImgTextPalette/ImgTextPalette'
import { IN_GAME_MENU_LABEL_FRAMES, IN_GAME_MENU_TITLE_FRAME } from '@/features/play-team-game/model/inGameMenu'
import type { InGameMenuAction, InGameMenuLayout } from '@/features/play-team-game/model/inGameMenu'
import * as styles from '@/features/play-team-game/ui/InGameMenu.css'
import {
  BOX_EDGE,
  BOX_FILL,
  DISABLED_LABEL,
  IMG_TEXT_FRAMES,
  NUM,
  NUM_DIGIT_WIDTHS,
  PALETTE4_MATRIX,
  PILL_NORMAL,
  PILL_SELECTED,
} from '@/features/play-team-game/ui/inGameMenu/inGameMenuLooks'
import { RoundFill } from '@/features/play-team-game/ui/inGameMenu/RoundFill'

/** 그리기 0x3cdd0 하위 0~3 갈래 — 둥근 칸 · "MENU" · 칸들 (`inGameMenuLayoutOf` 머리말) */
export function MenuPanel({
  layout,
  actions,
  cursor,
  canAutoProgress,
}: {
  readonly layout: InGameMenuLayout
  readonly actions: readonly InGameMenuAction[]
  readonly cursor: number
  readonly canAutoProgress: boolean
}) {
  const textOrigins = useFrameOrigins(IMG_TEXT_FRAMES)
  const palette3 = useImgTextPalette3()
  const palette4Id = `in-game-menu-p4-${useId().replace(/:/g, '')}`
  const { box, title } = layout
  return (
    <div className={styles.panel} data-testid="경기-메뉴-판" data-slide={box.x + 0x45}>
      {palette3.definition}
      <svg width={0} height={0} style={{ position: 'absolute' }} aria-hidden>
        <filter id={palette4Id} colorInterpolationFilters="sRGB">
          <feColorMatrix type="matrix" values={PALETTE4_MATRIX} />
        </filter>
      </svg>
      <RoundBox
        x={box.x}
        y={box.y}
        width={box.width}
        height={box.height}
        round={4}
        shine
        shineLength={0x3c}
        shineStep={2}
        fill={BOX_FILL}
        edge={BOX_EDGE}
        testId="경기-메뉴-칸"
      />
      <FrameSprite
        folder={IMG_TEXT_FRAMES}
        frame={IN_GAME_MENU_TITLE_FRAME}
        origins={textOrigins}
        x={title.x}
        y={title.y}
        style={{ filter: `url(#${palette4Id})` }}
      />
      {actions.map((action, index) => {
        const row = layout.rows[index]
        if (row === undefined) return null
        const isSelected = index === cursor
        const isGrey = action === '자동진행' && !canAutoProgress
        const frame = IN_GAME_MENU_LABEL_FRAMES[action]
        const digit = row.digit.value % 10
        const digitWidth = NUM_DIGIT_WIDTHS[digit] ?? 8
        return (
          <div key={action} data-testid={`경기-메뉴-칸-${index}`} data-selected={isSelected} data-grey={isGrey}>
            <RoundFill
              x={row.pill.x}
              y={row.pill.y}
              width={row.pill.width}
              height={row.pill.height}
              color={isSelected ? PILL_SELECTED : PILL_NORMAL}
            />
            {isGrey ? (
              <SolidStamp folder={IMG_TEXT_FRAMES} frame={frame} origins={textOrigins} x={row.label.x} y={row.label.y} color={DISABLED_LABEL} />
            ) : (
              <FrameSprite
                folder={IMG_TEXT_FRAMES}
                frame={frame}
                origins={textOrigins}
                x={row.label.x}
                y={row.label.y}
                {...(isSelected ? { style: palette3.style } : {})}
              />
            )}
            {/* 0xba689 정렬 2 — 왼쪽 = 가운데 + (0 − 폭) >> 1 (0xba5e4~0xba5ee) */}
            <img
              className={styles.sprite}
              alt=""
              src={`${NUM}/${String(digit).padStart(3, '0')}.png`}
              style={{ left: row.digit.centerX + ((0 - digitWidth) >> 1), top: row.digit.y }}
            />
          </div>
        )
      })}
    </div>
  )
}
