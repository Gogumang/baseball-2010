import { describe, expect, it } from 'vitest'
import {
  LIVE_GAME_STATE_COLD_INNING_INDEX,
  liveGameInningIndex,
  resetLiveGameState,
  setLiveGameInningIndex,
} from '@/shared/lib/liveGameState/liveGameState'

describe('전역 경기 상태 +0x6a · +0x6b (0x1552d0c)', () => {
  it('+0x6a 는 0xb6814 의 상수 6 이다', () => {
    expect(LIVE_GAME_STATE_COLD_INNING_INDEX).toBe(6)
  })

  it('마지막 경기의 이닝이 남고 0xb6814 가 0 으로 되돌린다', () => {
    setLiveGameInningIndex(6)
    expect(liveGameInningIndex()).toBe(6)
    resetLiveGameState()
    expect(liveGameInningIndex()).toBe(0)
  })
})
