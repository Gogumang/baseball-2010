import { describe, expect, it } from 'vitest'
import { derbyNoContactWaitFramesOf, derbyPitchCallOf } from '@/pages/home-run-derby/lib/derbyPitchCall'

describe('홈런더비 심판 콜 (0x9d57c → 0x3dfac → 0x51a56)', () => {
  it('스트라이크 · 헛스윙은 st[4] 를 안 세어 늘 18 — 39 · 삼진 21 은 없다 (3e14a)', () => {
    for (const isSwinging of [true, false]) {
      expect(derbyPitchCallOf({ kind: '스트라이크', isSwinging }, 0)).toEqual({ balls: 0, judgment: 1, soundId: 18 })
      expect(derbyPitchCallOf({ kind: '스트라이크', isSwinging }, 7)).toEqual({ balls: 7, judgment: 1, soundId: 18 })
    }
  })

  it('볼은 셋째까지 16, 넷째부터 볼넷 24 — 볼 수는 계속 오른다 (3e156 · 3e1ae, 원본 버그 그대로)', () => {
    let balls = 0
    const sounds: (number | null)[] = []
    for (let index = 0; index < 6; index += 1) {
      const call = derbyPitchCallOf({ kind: '볼' }, balls)
      balls = call.balls
      sounds.push(call.soundId)
    }
    expect(sounds).toEqual([16, 16, 16, 24, 24, 24])
    expect(balls).toBe(6)
  })

  it('사구는 23 — 볼 수는 그대로다 (v4 0x3e1b4)', () => {
    expect(derbyPitchCallOf({ kind: '사구' }, 2)).toEqual({ balls: 2, judgment: 4, soundId: 23 })
  })

  it('파울 · 맞은 공은 판이 콜을 낸다 — 여기서는 없다', () => {
    expect(derbyPitchCallOf({ kind: '파울' }, 1).soundId).toBeNull()
    expect(derbyPitchCallOf({ kind: '타구', outcome: { kind: '홈런' } }, 1).judgment).toBeNull()
  })

  it('맞지 않은 공의 대기는 15틱, 볼넷 · 사구면 31틱 (0x4e6de~0x4e6f0)', () => {
    expect(derbyNoContactWaitFramesOf(1)).toBe(15)
    expect(derbyNoContactWaitFramesOf(2)).toBe(15)
    expect(derbyNoContactWaitFramesOf(3)).toBe(31)
    expect(derbyNoContactWaitFramesOf(4)).toBe(31)
  })
})
