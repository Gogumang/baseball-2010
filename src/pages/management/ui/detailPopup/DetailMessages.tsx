import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { DETAIL_MESSAGE_LINE_HEIGHT, DETAIL_SCROLL_BAR_COLORS, detailMessageBoxOf, detailScrollBarOf } from '@/pages/management/lib/detailPopup'
import type { ScrollBarRect } from '@/pages/management/lib/detailPopup'
import * as styles from '@/pages/management/ui/DetailPopup.css'

const scrollBarRects = (bar: ReturnType<typeof detailScrollBarOf>): readonly (readonly [string, ScrollBarRect, string])[] => [
  ['track', bar.track, DETAIL_SCROLL_BAR_COLORS.track],
  ['thumb', bar.thumb, DETAIL_SCROLL_BAR_COLORS.thumb],
  ['thumbInner', bar.thumbInner, DETAIL_SCROLL_BAR_COLORS.thumbInner],
]

/** 글 한 줄 — 0xba269 가 색 마크업(!c)을 읽으며 그린다 (능력치 상세(120)의 "[!cFFFF00이름!cFFFFFF]") */
function MessageLine({ message }: { readonly message: string }) {
  return (
    <div style={{ height: DETAIL_MESSAGE_LINE_HEIGHT }}>
      {parseGameMarkup(message)
        .flatMap((line) => line.segments)
        .map((segment, segmentIndex) => (
          <span key={segmentIndex} style={segment.color === null ? undefined : { color: segment.color }}>
            {segment.text}
          </span>
        ))}
    </div>
  )
}

interface DetailMessagesProps {
  readonly messages: readonly string[]
  readonly scrollOffset: number
  readonly tableYOffset: number
}

/** 글 상자(첫 줄부터 16px 간격, 상자 밖은 잘린다 0x8a148~0x8a180)와 오른쪽 스크롤 막대(0x8a182~0x8a2a4 — 줄 수 ≤ 3 이면 가득, 아니면 4줄 몫 손잡이) */
export function DetailMessages({ messages, scrollOffset, tableYOffset }: DetailMessagesProps) {
  const box = detailMessageBoxOf(tableYOffset)
  return (
    <>
      <div className={styles.messages} style={{ left: box.x, top: box.y, width: box.width, height: box.height }}>
        {messages.slice(scrollOffset).map((message, index) => (
          <MessageLine key={scrollOffset + index} message={message} />
        ))}
      </div>
      <svg
        className={styles.layer}
        style={{ left: 0, top: 0 }}
        viewBox="0 0 240 320"
        width={240}
        height={320}
        shapeRendering="crispEdges"
        data-testid="상세스크롤막대"
      >
        {scrollBarRects(detailScrollBarOf(messages.length, scrollOffset, tableYOffset)).map(([name, rect, fill]) => (
          <rect key={name} data-part={name} x={rect.x} y={rect.y} width={rect.width} height={Math.max(rect.height, 0)} fill={fill} />
        ))}
      </svg>
    </>
  )
}
