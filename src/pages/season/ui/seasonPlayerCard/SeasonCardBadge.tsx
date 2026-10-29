import { SEASON_CARD_BADGE } from '@/pages/season/lib/seasonPlayerCard'
import { alignedPositionOf, managementStyles } from './otherSlices'
import { IMG_TEXT, SLT_FRAME, frameNameOf } from './cardAssets'
import { useFrameOrigins, type FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'

type BadgePart = (typeof SEASON_CARD_BADGE)['name'] | (typeof SEASON_CARD_BADGE)['title']

/** 딱지 글 — 정렬(`SEASON_CARD_BADGE.align`)로 판 안에 놓는다. 원점이 없으면 아무것도 */
function BadgeText({
  origins,
  frame,
  part,
  testId,
}: {
  readonly origins: FrameOrigins | null
  readonly frame: number
  readonly part: BadgePart
  readonly testId: string
}) {
  const origin = origins?.[frameNameOf(frame)]
  if (origin === undefined) return null
  const { x, y } = alignedPositionOf(part.board, origin.width, origin.height, SEASON_CARD_BADGE.align, part.ox, part.oy)
  return (
    <img
      className={managementStyles.layer}
      alt=""
      data-testid={testId}
      data-frame={frame}
      data-palette={part.palette}
      src={`${IMG_TEXT}/${frameNameOf(frame)}.png`}
      style={{ left: x + origin.x, top: y + origin.y }}
    />
  )
}

/** 딱지 판 — slt_frame 그림을 판 크기로 */
function BadgeBoard({ part, testId }: { readonly part: BadgePart; readonly testId: string }) {
  const { board } = part
  return (
    <img
      className={managementStyles.layer}
      alt=""
      data-testid={testId}
      data-image={board.image}
      src={`${SLT_FRAME}/${frameNameOf(board.image)}.png`}
      style={{ left: board.x, top: board.y, width: board.width, height: board.height }}
    />
  )
}

/**
 * 로고 아래 · 위 딱지 [gfx+0x168] — 0x7bbda~0x7bdca (`SEASON_CARD_BADGE`). 로고가 있을 때만(0x7bbca 가 로고 갈래 안) 부른다.
 * 판 A slt_frame 9 + 팀 이름 img_text 0x41+팀(팔레트 0) · 판 B slt_frame 116 + img_text 157(팔레트 4).
 * img_text 157 "PLAYER" 그림은 이미 팔레트 4 색(#7B797B · #525152)으로 떠 있어 따로 칠하지 않는다.
 */
export function SeasonCardBadge({ teamId }: { readonly teamId: number }) {
  const origins = useFrameOrigins(IMG_TEXT)
  const { name, title } = SEASON_CARD_BADGE
  return (
    <div data-testid="시즌카드-딱지">
      <BadgeBoard part={name} testId="시즌카드-딱지-이름판" />
      <BadgeText origins={origins} frame={name.frameBase + teamId} part={name} testId="시즌카드-딱지-팀이름" />
      <BadgeBoard part={title} testId="시즌카드-딱지-머리판" />
      <BadgeText origins={origins} frame={title.frame} part={title} testId="시즌카드-딱지-머리글" />
    </div>
  )
}
