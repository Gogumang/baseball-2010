import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  MENU_LABEL_FRAME,
  MENU_LABEL_POSITION,
  TIME_LABEL_FRAME,
  TIME_LABEL_POSITION,
  isTimeLabelState,
  showsTimeLabel,
} from '@/widgets/batting-stage/lib/softKeyLabels'

const origins = JSON.parse(readFileSync('public/sprites/game_ui/frames/origins.json', 'utf8')) as Record<
  string,
  { x: number; y: number; width: number; height: number }
>

describe('소프트키 글자 — 0x4c8e0~0x4c9fc', () => {
  it('"*MENU" 는 game_ui 프레임 90 을 (0, H − h − 1), "#TIME" 은 프레임 91 을 (W − w − 1, H − h − 1)', () => {
    expect(MENU_LABEL_FRAME).toBe(90)
    expect(TIME_LABEL_FRAME).toBe(91)
    const menu = origins['090']
    const time = origins['091']
    expect(MENU_LABEL_POSITION).toEqual({ x: 0, y: 320 - menu.height - 1 })
    expect(TIME_LABEL_POSITION).toEqual({ x: 240 - time.width - 1, y: 320 - time.height - 1 })
    expect(MENU_LABEL_POSITION).toEqual({ x: 0, y: 307 })
    expect(TIME_LABEL_POSITION).toEqual({ x: 198, y: 307 })
  })

  it('"#TIME" 상태는 0xe(쉬는 대기) · 0xf(대기 앞 9 그림)뿐이다', () => {
    expect(isTimeLabelState({ kind: '대기', tick: 0, isPaused: true })).toBe(true)
    expect(isTimeLabelState({ kind: '대기', tick: 8, isPaused: false })).toBe(true)
    expect(isTimeLabelState({ kind: '대기', tick: 9, isPaused: false })).toBe(false)
    expect(isTimeLabelState({ kind: '투구중', tick: 0, isPaused: false })).toBe(false)
    expect(isTimeLabelState({ kind: '결과', tick: 0, isPaused: false })).toBe(false)
  })

  it('벤치 수가 0 이하이거나 0x38984 가 거짓(null)이면 "#TIME" 을 안 그린다', () => {
    const state = { kind: '대기', tick: 0, isPaused: true } as const
    expect(showsTimeLabel(state, 3)).toBe(true)
    expect(showsTimeLabel(state, 0)).toBe(false)
    expect(showsTimeLabel(state, null)).toBe(false)
  })
})
