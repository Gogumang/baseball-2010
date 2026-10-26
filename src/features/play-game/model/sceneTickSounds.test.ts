import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { playSoundIdsAfterSceneTicks } from '@/features/play-game/model/sceneTickSounds'
import { createSilentSound } from '@/shared/api/audio/soundPort'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { gameSceneTickNow, resetCommonWindowShownForTest } from '@/shared/lib/commonWindow/commonWindow'

describe('장면 틱 뒤 소리 — 걸음이 여러 틀 몫일 때 뒤 틀의 소리', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    resetCommonWindowShownForTest()
  })

  const 녹음 = () => {
    const played: { id: number; tick: number }[] = []
    return { played, port: { ...createSilentSound(), play: (id: number) => played.push({ id, tick: gameSceneTickNow() }) } }
  }

  it('0 틱이면 곧바로, n 틱이면 n 틱 뒤 틀 머리에 차례대로 낸다 — 빈 칸은 건너뛴다', () => {
    const { played, port } = 녹음()
    const start = gameSceneTickNow()
    playSoundIdsAfterSceneTicks(port, [12], 0)
    playSoundIdsAfterSceneTicks(port, [18, null, 29], 3)
    expect(played).toEqual([{ id: 12, tick: start }])
    vi.advanceTimersByTime(millisecondsPerFrame() * 4)
    expect(played.map((sound) => sound.id)).toEqual([12, 18, 29])
    expect(played[1]!.tick).toBe(start + 3)
  })
})
