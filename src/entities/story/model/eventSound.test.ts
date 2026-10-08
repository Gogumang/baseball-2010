import { describe, expect, it } from 'vitest'
import { eventSoundCueOf, playEventSound } from '@/entities/story/model/eventSound'
import { createSilentSound } from '@/shared/api/audio/soundPort'

describe('이벤트 명령 6 소리 — 0x8d470~0x8d4be', () => {
  it('파일 = 번호 − 1, 반복 목록 {1, 3, 4, 40, 33, 46, 47, 52, 44} 이면 배경음', () => {
    expect(eventSoundCueOf(41)).toEqual({ file: 40, loop: true })
    expect(eventSoundCueOf(53)).toEqual({ file: 52, loop: true })
    expect(eventSoundCueOf(35)).toEqual({ file: 34, loop: false })
    expect(eventSoundCueOf(51)).toEqual({ file: 50, loop: false })
    for (const file of [1, 3, 4, 40, 33, 46, 47, 52, 44]) expect(eventSoundCueOf(file + 1).loop).toBe(true)
  })

  it('반복이 아니면 배경음을 멈추고(0x6e438) 효과음을 낸다', () => {
    const calls: string[] = []
    const port = {
      ...createSilentSound(),
      play: (id: number) => { calls.push(`효과 ${id}`) },
      playBgm: (id: number) => { calls.push(`배경 ${id}`) },
      stopBgm: () => { calls.push('멈춤') },
    }
    playEventSound(port, 35)
    playEventSound(port, 47)
    expect(calls).toEqual(['멈춤', '효과 34', '배경 46'])
  })
})
