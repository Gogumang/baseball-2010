import { describe, expect, it } from 'vitest'
import {
  nariMatchPushDirectionOf,
  screenPushFrameAt,
  screenPushStepOf,
} from '@/pages/management/lib/nariScreenPush'

describe('효과기 종류 8 화면 밀기 — 0xbdae8 · 0xbd966 · 0xbd740', () => {
  it('보폭 = 크기 × 200 / 길이 — 가로 240 · 1000 이면 48, 세로 320 이면 64', () => {
    expect(screenPushStepOf(3, 1000)).toBe(48)
    expect(screenPushStepOf(1, 1000)).toBe(64)
  })

  it('방향 3 — 새 화면이 오른쪽에서 들어오고 옛 화면이 왼쪽으로 밀린다. 다섯 프레임 뒤 끝', () => {
    expect(screenPushFrameAt(3, 0)).toEqual({ newX: 240, newY: 0, oldX: -0, oldY: 0 })
    expect(screenPushFrameAt(3, 2)).toEqual({ newX: 144, newY: 0, oldX: -96, oldY: 0 })
    expect(screenPushFrameAt(3, 4)).toEqual({ newX: 48, newY: 0, oldX: -192, oldY: 0 })
    expect(screenPushFrameAt(3, 5)).toBeNull()
  })

  it('방향 4 는 반대 · 1·2 는 한 줄 겹침(−1 · +1)까지 원본 그대로', () => {
    expect(screenPushFrameAt(4, 1)).toEqual({ newX: -192, newY: 0, oldX: 48, oldY: 0 })
    expect(screenPushFrameAt(1, 1)).toEqual({ newX: 0, newY: 255, oldX: 0, oldY: -64 })
    expect(screenPushFrameAt(2, 1)).toEqual({ newX: 0, newY: -255, oldX: 0, oldY: 64 })
  })

  it('142 → 143 내 팀 4 · 상대 3 / 143 → 142 내 팀 3 · 상대 4 (0x13c30 · 0x1457c)', () => {
    expect(nariMatchPushDirectionOf('142', '143:내팀')).toBe(4)
    expect(nariMatchPushDirectionOf('142', '143:상대')).toBe(3)
    expect(nariMatchPushDirectionOf('143:내팀', '142')).toBe(3)
    expect(nariMatchPushDirectionOf('143:상대', '142')).toBe(4)
    expect(nariMatchPushDirectionOf('142', '142')).toBeNull()
  })
})
