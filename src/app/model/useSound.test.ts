import { describe, expect, it } from 'vitest'
import { bgmToRestoreOnUnmute, soundLevelAfterKey } from '@/app/model/useSound'

describe('앱 전역 소리 단축키 0x2ddc (r197 직접 뜸)', () => {
  it('−13 은 단계 ≤ 3 이면 +1, 4 면 그대로 · −14 는 단계 > 0 이면 −1', () => {
    expect(soundLevelAfterKey(0, -13)).toBe(1)
    expect(soundLevelAfterKey(3, -13)).toBe(4)
    expect(soundLevelAfterKey(4, -13)).toBeNull()
    expect(soundLevelAfterKey(1, -14)).toBe(0)
    expect(soundLevelAfterKey(0, -14)).toBeNull()
  })

  it('0 → 1 로 켤 때 다시 트는 것은 +0x2c 가 배경음 1~4 일 때만 (0x2e22)', () => {
    expect(bgmToRestoreOnUnmute(1)).toBe(1)
    expect(bgmToRestoreOnUnmute(4)).toBe(4)
    expect(bgmToRestoreOnUnmute(5)).toBeNull()
    expect(bgmToRestoreOnUnmute(40)).toBeNull()
    expect(bgmToRestoreOnUnmute(null)).toBeNull()
  })
})
