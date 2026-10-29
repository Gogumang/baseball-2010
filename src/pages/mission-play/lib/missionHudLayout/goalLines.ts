import type { GoalTickerFrame } from '@/entities/mission/model/goalTicker'
import { PANEL, PANEL_X, SCREEN_WIDTH } from './hudPanel'

/** 0x36358 의 글 상자 폭 0x4b · 글 "!C%s"(0xcd760) 가운데 맞춤 */
export const GOAL_TEXT_WIDTH = 0x4b
/** 넘기는 동안 다음 줄이 놓이는 x 차이 — 글 0x4b · 숫자 0x32 (0x368e6 · 0x368d6) */
const NEXT_TEXT_SHIFT = 0x4b
const NEXT_COUNTER_SHIFT = 0x32

export interface ClipRect {
  readonly x: number
  readonly y: number
  readonly width: number
  readonly height: number
}

/**
 * 넘기는 동안의 자르기 창 (0x36838~0x36866):
 * 글 창 A = (W − w + 1, 0x17, 0x47, 0xe) — 0x9b901(글꼴, A) · 숫자 창 B = (W − w + 0x17, 0x27, 0x30, 0xe) — 그림 자르기 [+0x44].
 * 머무는 동안(0x36950)은 둘 다 0 이라 자르지 않는다.
 */
export const TEXT_CLIP: ClipRect = { x: SCREEN_WIDTH - PANEL.width + 1, y: 0x17, width: 0x47, height: 0xe }
export const COUNTER_CLIP: ClipRect = { x: SCREEN_WIDTH - PANEL.width + 0x17, y: 0x27, width: 0x30, height: 0xe }

export interface GoalLineDraw {
  /** 줄 번호 (`goals` 차례 = 목표 글 +0xe 를 '|' 로 자른 차례) */
  readonly index: number
  /** 글 상자 왼쪽 (y = 0x19, 폭 0x4b, 가운데) */
  readonly textX: number
  readonly textY: number
  /** "/" 자리 (y = 0x29) */
  readonly counterX: number
  readonly counterY: number
}

/**
 * 한 그림의 목표 줄 — 0x36358(장면, 글, 글x, 0x19, 숫자x, 0x29, 글 창, 숫자 창).
 * 글 x = x0 + (w − 0x4b)/2 − [+0x17fc] · 숫자 x = x0 + 0x31 − [+0x1800]. 넘기는 중이면 다음 줄을 (+0x4b, +0x32) 에 하나 더.
 * `goalTicker` 의 `offsetX` = [+0x17fc](글이 밀린 양) · `offsetY` = [+0x1800](**숫자**가 밀린 양 — 이름과 달리 가로다).
 */
export function goalLineDrawsOf(frame: GoalTickerFrame): GoalLineDraw[] {
  const textX = PANEL_X + Math.trunc((PANEL.width - GOAL_TEXT_WIDTH) / 2) - frame.offsetX
  const counterX = PANEL_X + 0x31 - frame.offsetY
  const current = { index: frame.index, textX, textY: 0x19, counterX, counterY: 0x29 }
  if (frame.nextIndex === null) return [current]
  return [current, { index: frame.nextIndex, textX: textX + NEXT_TEXT_SHIFT, textY: 0x19, counterX: counterX + NEXT_COUNTER_SHIFT, counterY: 0x29 }]
}
