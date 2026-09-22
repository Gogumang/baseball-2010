import { describe, expect, it, vi } from 'vitest'
import { createSilentSound } from '@/shared/api/audio/soundPort'
import { createWebAudioSound } from '@/shared/api/audio/webAudioSound'

/**
 * 소리 포트. 원본 사운드 객체(0x6ea6c/0x6e438/0x6eaf0/0x6e4d0)의 규칙을 지키는지 본다.
 * jsdom·node 에는 AudioContext 가 없으므로 "없어도 안 터진다" 가 첫 번째 조건이다.
 */

interface StartedSound {
  readonly url: string
  readonly loop: boolean
}

/** 무엇이 언제 울렸는지 적어 두는 가짜 통로 */
interface FakeSource {
  buffer: { url: string } | null
  loop: boolean
  onended: (() => void) | null
  connect: () => void
  start: () => void
  stop: () => void
}

function createFakeAudio() {
  const started: StartedSound[] = []
  const stopped: string[] = []
  const fetched: string[] = []
  /** 튼 순서대로의 재생 통로 — 브라우저가 "다 울렸다" 고 알리는 것을 흉내내는 데 쓴다 */
  const sources: FakeSource[] = []
  const gain = { value: 1 }

  const context = {
    state: 'running',
    destination: {},
    createGain: () => ({ gain, connect: () => {} }),
    createBufferSource: () => {
      // 어느 파일인지는 붙여 준 buffer 에 적혀 있다 (실제 WebAudio 도 buffer 를 나중에 넣는다).
      const source: FakeSource = {
        buffer: null,
        loop: false,
        onended: null,
        connect: () => {},
        start: () => {
          started.push({ url: source.buffer?.url ?? '?', loop: source.loop })
          sources.push(source)
        },
        stop: () => stopped.push(source.buffer?.url ?? '?'),
      }
      return source
    },
    decodeAudioData: async (bytes: ArrayBuffer) =>
      ({ url: new TextDecoder().decode(bytes) }) as unknown as AudioBuffer,
    resume: () => Promise.resolve(),
  }

  const fetchAudio = async (url: string) => {
    fetched.push(url)
    // 디코드 쪽에서 어느 파일인지 알아보도록 url 을 그대로 바이트로 넘긴다.
    return new TextEncoder().encode(url).buffer as ArrayBuffer
  }

  return {
    started,
    stopped,
    fetched,
    /** n 번째로 튼 소리가 끝났다고 알린다 (기본: 가장 마지막) */
    fireEnded: (index = sources.length - 1) => sources[index]?.onended?.(),
    gain,
    options: {
      createContext: () => context as unknown as AudioContext,
      fetchAudio,
    },
  }
}

describe('소리 포트 — AudioContext 가 없는 환경', () => {
  it('통로를 못 열어도 아무것도 터지지 않는다', () => {
    const sound = createWebAudioSound({ createContext: () => null })

    expect(() => {
      sound.play(18)
      sound.playBgm(1)
      sound.resumeBgm()
      sound.stopBgm()
      sound.setVolume(50)
    }).not.toThrow()
    expect(sound.getVolume()).toBe(50)
  })

  it('통로 열기가 예외를 던져도 삼킨다', () => {
    const sound = createWebAudioSound({
      createContext: () => {
        throw new Error('AudioContext 없음')
      },
    })

    expect(() => sound.play(18)).not.toThrow()
  })
})

describe('소리 포트 — 소리가 꺼져 있을 때', () => {
  it('크기 0 이면 파일을 받지도 않는다', () => {
    const fake = createFakeAudio()
    const sound = createWebAudioSound({ ...fake.options, volume: 0 })

    sound.play(18)
    sound.playBgm(1)

    expect(fake.fetched, `받은 파일: ${fake.fetched.join(',')}`).toEqual([])
    expect(fake.started).toEqual([])
  })

  it('크기 0 이어도 배경음 번호는 기억한다 (원본 0x6ea86)', async () => {
    const fake = createFakeAudio()
    const sound = createWebAudioSound({ ...fake.options, volume: 0 })

    sound.playBgm(33)
    expect(sound.currentBgm()).toBe(33)

    // 소리를 켜고 복귀하면 그때 기억해 둔 번호가 울린다.
    sound.setVolume(100)
    sound.resumeBgm()
    await vi.waitFor(() => expect(fake.started).toEqual([{ url: 'sounds/033.mp3', loop: true }]))
  })
})

describe('소리 포트 — 재생', () => {
  it('번호를 원본 이름 규칙(%03d)대로 찾는다', async () => {
    const fake = createFakeAudio()
    const sound = createWebAudioSound(fake.options)

    sound.play(5)

    await vi.waitFor(() => expect(fake.started).toEqual([{ url: 'sounds/005.mp3', loop: false }]))
  })

  it('배경음은 반복으로, 효과음은 한 번만 튼다', async () => {
    const fake = createFakeAudio()
    const sound = createWebAudioSound(fake.options)

    sound.playBgm(1)
    await vi.waitFor(() => expect(fake.started).toHaveLength(1))
    sound.play(18)
    await vi.waitFor(() => expect(fake.started).toHaveLength(2))

    expect(fake.started).toEqual([
      { url: 'sounds/001.mp3', loop: true },
      { url: 'sounds/018.mp3', loop: false },
    ])
  })

  it('통로가 하나뿐이라 새 소리가 울리던 소리를 끊는다 (원본 0x6e258)', async () => {
    const fake = createFakeAudio()
    const sound = createWebAudioSound(fake.options)

    sound.playBgm(1)
    await vi.waitFor(() => expect(fake.started).toHaveLength(1))
    sound.play(18)
    await vi.waitFor(() => expect(fake.started).toHaveLength(2))

    expect(fake.stopped, '배경음이 끊겨야 한다').toEqual(['sounds/001.mp3'])
  })

  it('복귀는 기억해 둔 배경음을 다시 튼다 (원본 0x6eaf0)', async () => {
    const fake = createFakeAudio()
    const sound = createWebAudioSound(fake.options)

    sound.playBgm(4)
    await vi.waitFor(() => expect(fake.started).toHaveLength(1))
    sound.play(22)
    await vi.waitFor(() => expect(fake.started).toHaveLength(2))
    sound.resumeBgm()

    await vi.waitFor(() => expect(fake.started).toHaveLength(3))
    expect(fake.started[2]).toEqual({ url: 'sounds/004.mp3', loop: true })
    expect(sound.currentBgm()).toBe(4)
  })

  it('배경음을 멈추면 기억도 지운다 (원본 0x6e438)', async () => {
    const fake = createFakeAudio()
    const sound = createWebAudioSound(fake.options)

    sound.playBgm(33)
    await vi.waitFor(() => expect(fake.started).toHaveLength(1))
    sound.stopBgm()

    expect(sound.currentBgm()).toBeNull()
    expect(fake.stopped).toEqual(['sounds/033.mp3'])
    sound.resumeBgm()
    expect(fake.started).toHaveLength(1)
  })

  it('같은 배경음을 다시 부르면 처음부터 다시 틀지 않는다', async () => {
    const fake = createFakeAudio()
    const sound = createWebAudioSound(fake.options)

    sound.playBgm(1)
    await vi.waitFor(() => expect(fake.started).toHaveLength(1))
    sound.playBgm(1)

    await vi.waitFor(() => expect(fake.fetched).toEqual(['sounds/001.mp3']))
    expect(fake.started).toHaveLength(1)
  })

  it('효과음이 끝나면 배경음이 **원래 번호로** 돌아온다 (원본 resumeBgm 0x6eaf0 자리)', async () => {
    const fake = createFakeAudio()
    const sound = createWebAudioSound(fake.options)

    sound.playBgm(33)
    await vi.waitFor(() => expect(fake.started).toHaveLength(1))
    // 삼진 콜이 배경음을 끊는다 — 원본도 통로가 하나뿐이다
    sound.play(21)
    await vi.waitFor(() => expect(fake.started).toHaveLength(2))
    expect(fake.stopped).toEqual(['sounds/033.mp3'])

    fake.fireEnded()

    await vi.waitFor(() => expect(fake.started).toHaveLength(3))
    expect(fake.started[2]).toEqual({ url: 'sounds/033.mp3', loop: true })
    expect(sound.currentBgm()).toBe(33)
  })

  it('효과음을 잇달아 내도 마지막 하나가 끝난 뒤 한 번만 돌아온다', async () => {
    const fake = createFakeAudio()
    const sound = createWebAudioSound(fake.options)

    sound.playBgm(33)
    await vi.waitFor(() => expect(fake.started).toHaveLength(1))
    sound.play(6)
    await vi.waitFor(() => expect(fake.started).toHaveLength(2))
    sound.play(20)
    await vi.waitFor(() => expect(fake.started).toHaveLength(3))

    // 먼저 튼 타격음이 뒤늦게 끝났다고 알려도 통로를 가져간 쪽이 아니므로 되돌리지 않는다
    fake.fireEnded(1)
    expect(fake.started).toHaveLength(3)

    fake.fireEnded(2)
    await vi.waitFor(() => expect(fake.started).toHaveLength(4))
    expect(fake.started[3]).toEqual({ url: 'sounds/033.mp3', loop: true })
  })

  it('배경음이 없었으면 효과음이 끝나도 아무것도 틀지 않는다', async () => {
    const fake = createFakeAudio()
    const sound = createWebAudioSound(fake.options)

    sound.play(18)
    await vi.waitFor(() => expect(fake.started).toHaveLength(1))
    fake.fireEnded()

    expect(fake.started).toHaveLength(1)
    expect(sound.currentBgm()).toBeNull()
  })

  it('배경음을 멈춘 뒤 효과음이 끝나도 되살리지 않는다 (0x6e438 이 기억을 지운다)', async () => {
    const fake = createFakeAudio()
    const sound = createWebAudioSound(fake.options)

    sound.playBgm(33)
    await vi.waitFor(() => expect(fake.started).toHaveLength(1))
    sound.stopBgm()
    sound.play(22)
    await vi.waitFor(() => expect(fake.started).toHaveLength(2))
    fake.fireEnded()

    expect(fake.started).toHaveLength(2)
    expect(sound.currentBgm()).toBeNull()
  })

  it('파일을 못 받으면 그 소리만 빠지고 다음 소리는 울린다', async () => {
    const fake = createFakeAudio()
    const sound = createWebAudioSound({
      ...fake.options,
      fetchAudio: async (url: string) => {
        if (url.endsWith('099.mp3')) throw new Error('404')
        return await fake.options.fetchAudio(url)
      },
    })

    sound.play(99)
    sound.play(18)

    await vi.waitFor(() => expect(fake.started).toEqual([{ url: 'sounds/018.mp3', loop: false }]))
  })
})

describe('소리 크기', () => {
  it('0~100 밖의 값은 잘라 넣는다 (원본 0x6e4d0)', () => {
    const fake = createFakeAudio()
    const sound = createWebAudioSound(fake.options)

    sound.setVolume(140)
    expect(sound.getVolume()).toBe(100)
    sound.setVolume(-20)
    expect(sound.getVolume()).toBe(0)
    sound.setVolume(Number.NaN)
    expect(sound.getVolume()).toBe(0)
  })

  it('환경설정 칸(0~4)×25 가 그대로 들어간다', async () => {
    const fake = createFakeAudio()
    const sound = createWebAudioSound(fake.options)

    sound.play(5)
    await vi.waitFor(() => expect(fake.started).toHaveLength(1))
    sound.setVolume(2 * 25)

    expect(fake.gain.value).toBeCloseTo(0.5)
  })

  it('크기를 0 으로 내리면 울리던 소리를 멈춘다', async () => {
    const fake = createFakeAudio()
    const sound = createWebAudioSound(fake.options)

    sound.playBgm(1)
    await vi.waitFor(() => expect(fake.started).toHaveLength(1))
    sound.setVolume(0)

    expect(fake.stopped).toEqual(['sounds/001.mp3'])
  })
})

describe('소리 없는 포트', () => {
  it('배경음 번호만 기억하고 아무것도 울리지 않는다', () => {
    const sound = createSilentSound()

    sound.playBgm(33)
    expect(sound.currentBgm()).toBe(33)
    sound.stopBgm()
    expect(sound.currentBgm()).toBeNull()
    expect(sound.getVolume()).toBe(0)
  })
})
