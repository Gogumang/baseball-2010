import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  PITCH_SPEED_DIGIT_BASE,
  PITCH_SPEED_PLATE_FRAME,
  PITCH_SPEED_PLATE_POSITION,
  PITCH_SPEED_UNITS_POSITION,
  isPitchSpeedState,
  pitchSpeedDigitsOf,
  showsPitchSpeedDigits,
} from '@/widgets/batting-stage/lib/pitchSpeedReadout'

const origins = JSON.parse(readFileSync('public/sprites/game_ui/frames/origins.json', 'utf8')) as Record<
  string,
  { x: number; y: number; width: number; height: number }
>
const boxes = JSON.parse(readFileSync('public/sprites/game_ui/frames/boxes.json', 'utf8')) as Record<
  string,
  [number, number, number, number][]
>

describe('표시 구속 "Km" 판 — 0x4c4bc 의 0x4c9fc~0x4cac8', () => {
  it('판은 game_ui 프레임 20(원점 (−21, −18))을 (W/2, H/2) 에, 일의 자리는 상자 0 (−2, −15) + (120, 160) = (118, 145)', () => {
    expect(PITCH_SPEED_PLATE_FRAME).toBe(20)
    expect(origins['020']).toMatchObject({ x: -21, y: -18 })
    expect(boxes['020'][0]).toEqual([-2, -15, 7, 12])
    expect(PITCH_SPEED_PLATE_POSITION).toEqual({ x: 120, y: 160 })
    expect(PITCH_SPEED_UNITS_POSITION).toEqual({ x: 118, y: 145 })
  })

  it('숫자는 num 그림 60 + 자리, 일의 자리부터 왼쪽으로 상자 w + 1 = 8 씩', () => {
    expect(PITCH_SPEED_DIGIT_BASE).toBe(60)
    expect(pitchSpeedDigitsOf(147)).toEqual([
      { image: 67, x: 118 },
      { image: 64, x: 110 },
      { image: 61, x: 102 },
    ])
    // 먼저 그리고 나중에 묻는 고리 — 0 도 "0" 하나
    expect(pitchSpeedDigitsOf(0)).toEqual([{ image: 60, x: 118 }])
  })

  it('상태 틱 0 · 2 는 숫자를 숨기고 1 · 3~ 은 보인다 (4ca66)', () => {
    expect([0, 1, 2, 3, 4, 5, 15].map(showsPitchSpeedDigits)).toEqual([false, true, false, true, true, true, true])
  })

  it('상태 0x12 만 — 맞은 공 뒤 인플레이(0x17) 자리의 웹 \'결과\' 와 다른 단계는 안 그린다', () => {
    expect(isPitchSpeedState({ kind: '결과', tick: 0, isPaused: false })).toBe(true)
    expect(isPitchSpeedState({ kind: '결과', tick: 0, isPaused: false, isInPlay: false })).toBe(true)
    expect(isPitchSpeedState({ kind: '결과', tick: 0, isPaused: false, isInPlay: true })).toBe(false)
    expect(isPitchSpeedState({ kind: '투구중', tick: 20, isPaused: false })).toBe(false)
    expect(isPitchSpeedState({ kind: '타격', tick: 0, isPaused: false })).toBe(false)
    expect(isPitchSpeedState({ kind: '대기', tick: 0, isPaused: true })).toBe(false)
  })
})
