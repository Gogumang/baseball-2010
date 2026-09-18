import { afterEach, describe, expect, it } from 'vitest'
import {
  DEFAULT_SPEED_LEVEL,
  MILLISECONDS_PER_FRAME_BY_SPEED,
  millisecondsPerFrame,
  setGameSpeedLevel,
} from '@/shared/config/frameRate'

describe('게임 속도 — binary.mod 속도 옵션 표 0xd7624', () => {
  afterEach(() => setGameSpeedLevel(DEFAULT_SPEED_LEVEL))

  it('다섯 단계 4·10·16·22·28fps 다', () => {
    expect(MILLISECONDS_PER_FRAME_BY_SPEED).toEqual([250, 100, 62, 45, 35])
  })

  it('기본은 가운데 단계(62ms)다', () => {
    expect(millisecondsPerFrame()).toBe(62)
  })

  it('단계를 바꾸면 갱신 시간이 바뀐다', () => {
    setGameSpeedLevel(4)

    expect(millisecondsPerFrame()).toBe(35)
  })

  it('범위를 벗어난 단계는 거절한다', () => {
    expect(() => setGameSpeedLevel(5)).toThrow()
    expect(millisecondsPerFrame()).toBe(62)
  })
})
