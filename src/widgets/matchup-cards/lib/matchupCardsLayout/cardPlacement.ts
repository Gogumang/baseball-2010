/** 판 밀림(0x6c7c0 사인) · 판 기준점 · 상자 안 그림 자리(0xb9d74) */
import { sineSixteen } from '@/shared/lib/math/originalTrigonometry'
import {
  BATTER_CARD_TOP,
  type CardBox,
  MATCHUP_SCREEN,
  PITCHER_CARD_TOP,
  SLIDE_DISTANCE,
} from '@/widgets/matchup-cards/lib/matchupCardsLayout/cardBoxes'
import type { FrameSize } from '@/widgets/matchup-cards/lib/matchupCardsLayout/cardFrames'

/** `0x6c7c0` 의 값 × 0x8c >> 16 */
const slideStepOf = (angle: number) => (sineSixteen(angle) * SLIDE_DISTANCE) >> 16

/**
 * 틱(상태 0xe 의 [장면+0x2c]) → 밀림 o. 0xe 에 들어선 틱이 0 이다 — `0xbc9c8` 이 상태를 바꿀 때 +0x14 = 0,
 * 그대로면 +0x14++ 한 뒤 진입 → 키 → 갱신 → **그리기** 차례라 첫 그림이 틱 0 이다.
 */
export function slideOffsetAt(tick: number): number {
  const start = tick === 0 ? 0x5a : 0x6e
  const angle = Math.min(tick * 16, 0x6e)
  return slideStepOf(start) - slideStepOf(angle)
}

export interface CardOrigins {
  readonly pitcher: { readonly x: number; readonly y: number }
  readonly batter: { readonly x: number; readonly y: number }
}

/**
 * 두 판의 왼쪽 위.
 * @param batterHand `0xb63c0(지금 타자)` — 1 좌타 · 0 우타
 * @param side 장면 +0x17e1 — 적재 8(0x4887e)이 같은 0xb63c0(모드 타자)로 넣는다. 안 넘기면 `batterHand`
 */
export function cardOriginsAt(tick: number, batterHand: number, side: number = batterHand): CardOrigins {
  const offset = slideOffsetAt(tick)
  const far = MATCHUP_SCREEN.width + offset - SLIDE_DISTANCE
  const pitcherBase = batterHand !== 0 ? far : -offset
  const batterBase = batterHand !== 0 ? -offset : far
  return {
    pitcher: { x: pitcherBase + (side > 0 ? 5 : -3), y: PITCHER_CARD_TOP },
    batter: { x: batterBase + (side > 0 ? -3 : 3), y: BATTER_CARD_TOP },
  }
}

export interface Placed {
  readonly x: number
  readonly y: number
}

/** 0xb9d74 의 세로 가운데 — d = 칸 − 그림 → `(d >> 1) + (d − trunc(d/2)·2)` (양수면 올림) */
export const halfUp = (difference: number) => (difference >> 1) + (difference - Math.trunc(difference / 2) * 2)

/**
 * 박스에 프레임 하나 — `0xb9e8c(프레임, 배치, 박스, 정렬, 0, 0, ox, oy)` → `0xb9d74`.
 * 정렬 비트 0x2 가로 가운데 `+ (박스폭 − 프레임폭) >> 1` · 0x4 오른쪽 · 0x20 세로 가운데 · 0x40 아래. 0x11 은 왼쪽 위 그대로.
 * 돌려주는 자리는 프레임 원점이고 그림은 거기에 `[+0xe]`·`[+0x10]` 을 더한 곳에 놓인다.
 */
export function framePlacementOf(cardBox: CardBox, size: FrameSize, anchor: number, origin: Placed): Placed {
  let x = cardBox.x + origin.x
  let y = cardBox.y + origin.y
  if ((anchor & 0x2) !== 0) x += (cardBox.width - size.width) >> 1
  if ((anchor & 0x4) !== 0) x -= size.width - cardBox.width
  if ((anchor & 0x20) !== 0) y += halfUp(cardBox.height - size.height)
  if ((anchor & 0x40) !== 0) y -= size.height - cardBox.height
  return { x, y }
}
