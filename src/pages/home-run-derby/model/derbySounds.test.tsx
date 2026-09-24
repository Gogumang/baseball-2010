// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useHomeRunDerby } from '@/pages/home-run-derby/model/useHomeRunDerby'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { LOSE_SOUND, WIN_SOUND } from '@/features/play-game/model/gameSounds'
import { setActiveSound } from '@/shared/api/audio/soundPort'
import type { SoundPort } from '@/shared/api/audio/soundPort'

/** 무엇이 몇 번 울렸는지 적어 두는 포트 */
function 녹음포트() {
  const played: number[] = []
  const port: SoundPort = {
    play: (id) => {
      played.push(id)
    },
    playBgm: () => {},
    stopBgm: () => {},
    resumeBgm: () => {},
    currentBgm: () => null,
    setVolume: () => {},
    getVolume: () => 100,
  }
  return { played, port }
}

const 홈런코드 = 24

/** 강한 타구 타격음 5 가 붙은 홈런 하나 (번호는 `atBatSounds` 가 골라 둔 것을 그대로 받는다) */
const 홈런: PitchOutcomeDetail = {
  resolution: { kind: '타구', outcome: { kind: '홈런' } },
  hasSwung: true,
  isBunt: false,
  resultCode: 홈런코드,
  contactSoundId: 5,
}

const 헛스윙: PitchOutcomeDetail = {
  resolution: { kind: '스트라이크', isSwinging: true },
  hasSwung: true,
  isBunt: false,
  resultCode: null,
  contactSoundId: 8,
}

let 녹음 = 녹음포트()
beforeEach(() => {
  vi.useFakeTimers()
  녹음 = 녹음포트()
  setActiveSound(녹음.port)
})
afterEach(() => {
  vi.useRealTimers()
  setActiveSound(null)
})

function 띄우기(bestDistance = 0) {
  const random = createSeededRandom(5)
  return renderHook(() => useHomeRunDerby({ random, bestDistance }))
}

function 한구(rendered: { result: { current: ReturnType<typeof useHomeRunDerby> } }, detail: PitchOutcomeDetail) {
  act(() => rendered.result.current.onPitchResolved(detail))
  act(() => {
    vi.advanceTimersByTime(2_000)
  })
}

describe('홈런더비 소리', () => {
  it('공마다 타구음이 난다 (0x515de~0x5164a 가 고른 번호를 그대로 쓴다)', () => {
    const rendered = 띄우기()
    한구(rendered, 홈런)
    expect(녹음.played).toContain(5)
    한구(rendered, 헛스윙)
    expect(녹음.played).toContain(8)
  })

  it('판이 끝나고 신기록이면 31, 아니면 32 (결과 진입 0x4f574)', () => {
    // 홈런은 콤보가 붙어 보너스 게임만큼 기회가 늘어난다 — 판이 닫힐 때까지 친다
    const 신기록 = 띄우기(0)
    for (let i = 0; i < 40 && 신기록.result.current.result === null; i += 1) 한구(신기록, 홈런)
    expect(신기록.result.current.result?.isNewRecord).toBe(true)
    expect(녹음.played.at(-1)).toBe(WIN_SOUND)

    녹음.played.length = 0
    const 실패 = 띄우기(65535)
    for (let i = 0; i < 10; i += 1) 한구(실패, 헛스윙)
    expect(실패.result.current.result?.isNewRecord).toBe(false)
    expect(녹음.played.at(-1)).toBe(LOSE_SOUND)
  })
})
