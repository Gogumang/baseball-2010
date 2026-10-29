import { SPECIAL_ITEMS, SPECIAL_REEL_STATE } from '@/pages/special/lib/specialLayout'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import {
  MENU_REEL_ITEM_FRAMES,
  MENU_REEL_SCROLL_STEPS,
  MENU_REEL_SHADOW_COLOR,
  MENU_REEL_SHADOW_OFFSET,
  MENU_REEL_SLOTS,
  menuReelEntryAtSlotOf,
  menuReelFrameListOf,
  menuReelSlotRowOf,
  menuReelTextTopLeftOf,
  menuStyles,
} from '@/pages/special/ui/specialScreen/otherSlices'
import { IMG_TEXT_FRAMES, imageSrc } from '@/pages/special/ui/specialScreen/specialAssets'
import { TintedLabel } from '@/pages/special/ui/specialScreen/TintedLabel'

/** 상태 6 릴 표 — 글자 0xcea24 · 슬롯 0xceaf2[1] */
const REEL_FRAMES = MENU_REEL_ITEM_FRAMES[SPECIAL_REEL_STATE] ?? []
const REEL_FRAME_LIST = menuReelFrameListOf(REEL_FRAMES)
const REEL_SLOT_ROW = menuReelSlotRowOf(SPECIAL_REEL_STATE)

/** ↑(−1) 면 +, ↓(−2) 면 − 로 민다 (0x2534c). 안 돌면 0 */
function reelScrollOf(direction: number | null, counter: number): number {
  if (direction === null) return 0
  const sign = direction === -1 ? 1 : -1
  return sign * (MENU_REEL_SCROLL_STEPS[counter] ?? 0)
}

interface SpecialReelProps {
  readonly isGrowing: boolean
  /** 릴 돌기 방향(−1 위 · 그 밖 아래) · 스크롤 틱 */
  readonly direction: number | null
  readonly counter: number
  /** 도는 동안은 돌기 전 배열을 그린다 */
  readonly shownCursor: number
  readonly textOrigins: FrameOrigins | null
  readonly onPick: (index: number) => void
}

/** 릴 한 슬롯 — 칸이 없거나 화면 밖이면 null */
function reelLabelOf({ isGrowing, shownCursor, textOrigins, onPick }: SpecialReelProps, scroll: number, slot: number) {
  const entryIndex = menuReelEntryAtSlotOf(REEL_FRAMES, REEL_SLOT_ROW, shownCursor, slot)
  if (entryIndex === null) return null
  const frame = REEL_FRAME_LIST[entryIndex]
  const item = SPECIAL_ITEMS[entryIndex]
  const size = textOrigins?.[String(frame).padStart(3, '0')] ?? null
  if (size === null || item === undefined) return null
  const topLeft = menuReelTextTopLeftOf(slot, size.width, scroll)
  if (topLeft === null) return null
  const src = imageSrc(IMG_TEXT_FRAMES, frame)
  return (
    <div key={item.id} data-reel-slot={slot}>
      {/* 그림자를 #212B70 으로 (+1,+1) 에 먼저 찍고 진짜 글자를 원색으로 덮는다 (0x255c8) */}
      <TintedLabel
        src={src}
        left={topLeft.x + MENU_REEL_SHADOW_OFFSET.x}
        top={topLeft.y + MENU_REEL_SHADOW_OFFSET.y}
        width={size.width}
        height={size.height}
        color={MENU_REEL_SHADOW_COLOR}
      />
      <button
        type="button"
        aria-label={item.id}
        className={menuStyles.menuRow}
        data-frame={frame}
        style={{ left: topLeft.x, top: topLeft.y }}
        // ⚠️ 웹 조작 — 누르면 고르기만 한다(원본은 키패드뿐). 여는 것은 설명 판 누름(OK)이다
        onClick={() => (isGrowing ? undefined : onPick(entryIndex))}
      >
        <img src={src} alt="" />
      </button>
    </div>
  )
}

/** 세로 릴 0x2524c(…, 6) — 슬롯 1·2·3 · 5·6·7 (4 는 판이 대신). 바탕 띠가 자라는 동안은 안 그린다 */
export function SpecialReel(props: SpecialReelProps) {
  if (props.isGrowing) return []
  const scroll = reelScrollOf(props.direction, props.counter)
  return MENU_REEL_SLOTS.map((slot) => reelLabelOf(props, scroll, slot))
}
