import { describe, expect, it } from 'vitest'
import { relayFieldBackgroundAt } from '@/pages/auto-play-relay/lib/relayFieldBackground'

describe('상태 0x21 배경 — 0x3abf0 이 카메라를 투수판 (20000, 24500) 에 즉시 맞추고 0x78930 이 그 오프셋에 깐다', () => {
  it('240×320 이면 (−190, −180), 오른쪽 반은 효과 0x11 로 (x + 310 − 1)', () => {
    expect(relayFieldBackgroundAt()).toEqual({ x: -190, y: -180, mirroredX: 119 })
  })
})
