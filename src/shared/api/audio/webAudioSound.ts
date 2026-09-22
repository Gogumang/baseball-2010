import type { SoundPort } from '@/shared/api/audio/soundPort'
import { soundFileUrl } from '@/shared/config/original/sounds'

/**
 * WebAudio 로 `public/sounds/%03d.mp3` 를 트는 포트 구현.
 *
 * 파일은 `tools/extract_sounds.py` 가 원본 `sound/%03d.mmf`(야마하 SMAF) 에서 구워 둔 것이다.
 * 브라우저는 SMAF 를 직접 못 읽어서 미리 굽는 길을 골랐다 (docs/re/L-sound-effects.md 1-D).
 *
 * `AudioContext` 가 없는 환경(jsdom·서버 렌더)에서는 **아무 소리도 내지 않고 조용히 넘어간다**.
 * 소리가 안 나는 것 때문에 게임이 멈추면 안 되므로 모든 접근을 try/catch 로 감쌌다.
 *
 * 원본 규칙 하나를 웹 쪽으로 옮겨 적었다: 효과음은 배경음을 끊지만 **끝나면 배경음으로 돌아온다**
 * (`start` 의 `onended` 주석 — 원본은 팝업이 끝나는 자리마다 `resumeBgm` 을 손으로 부른다).
 */

/** 재생 통로를 여는 함수. 못 열면 null. */
export type AudioContextFactory = () => AudioContext | null

export interface WebAudioSoundOptions {
  /** 파일이 놓인 곳. 기본 `sounds` (= `public/sounds`) */
  readonly baseUrl?: string
  /** 처음 소리 크기 0~100 */
  readonly volume?: number
  /** 통로 열기 (테스트에서 갈아 끼운다) */
  readonly createContext?: AudioContextFactory
  /** 파일 가져오기 (테스트에서 갈아 끼운다) */
  readonly fetchAudio?: (url: string) => Promise<ArrayBuffer>
}

type MaybeAudioContextCtor = { AudioContext?: new () => AudioContext; webkitAudioContext?: new () => AudioContext }

const defaultCreateContext: AudioContextFactory = () => {
  try {
    const global = globalThis as unknown as MaybeAudioContextCtor
    const Ctor = global.AudioContext ?? global.webkitAudioContext
    return Ctor ? new Ctor() : null
  } catch {
    // jsdom 에는 AudioContext 가 없다. 소리 없이 계속 간다.
    return null
  }
}

const defaultFetchAudio = async (url: string): Promise<ArrayBuffer> => {
  const response = await fetch(url)
  return await response.arrayBuffer()
}

const clampVolume = (volume: number): number => {
  if (!Number.isFinite(volume)) return 0
  return Math.max(0, Math.min(100, Math.round(volume)))
}

export function createWebAudioSound(options: WebAudioSoundOptions = {}): SoundPort {
  const baseUrl = options.baseUrl ?? 'sounds'
  const createContext = options.createContext ?? defaultCreateContext
  const fetchAudio = options.fetchAudio ?? defaultFetchAudio

  let volume = clampVolume(options.volume ?? 100)
  let context: AudioContext | null = null
  let contextOpened = false
  let master: GainNode | null = null

  /** 번호 → 디코드한 소리. 실패도 기억해 두어 같은 파일을 계속 다시 받지 않는다. */
  const buffers = new Map<number, Promise<AudioBuffer | null>>()

  /** 원본은 통로가 하나뿐이라 새 소리가 울리던 소리를 끊는다. */
  let activeSource: AudioBufferSourceNode | null = null
  /** 늦게 도착한 소리가 이미 지나간 장면에서 울리지 않게 하는 표 */
  let playToken = 0

  /** 원본 +0x28 — 기억해 둔 배경음 */
  let rememberedBgmId: number | null = null
  /** 원본 +0x2c — 지금 울리는 배경음 */
  let playingBgmId: number | null = null

  const openContext = (): AudioContext | null => {
    if (contextOpened) return context
    contextOpened = true
    try {
      context = createContext()
    } catch {
      context = null
    }
    if (context) {
      try {
        master = context.createGain()
        master.gain.value = volume / 100
        master.connect(context.destination)
      } catch {
        context = null
        master = null
      }
    }
    return context
  }

  const loadBuffer = (id: number, ctx: AudioContext): Promise<AudioBuffer | null> => {
    const cached = buffers.get(id)
    if (cached) return cached
    const loading = (async () => {
      try {
        const bytes = await fetchAudio(soundFileUrl(id, baseUrl))
        return await ctx.decodeAudioData(bytes)
      } catch {
        // 파일이 없거나 브라우저가 못 읽는다 — 그 소리만 조용히 빠진다.
        return null
      }
    })()
    buffers.set(id, loading)
    return loading
  }

  const stopActive = () => {
    if (!activeSource) return
    try {
      activeSource.stop()
    } catch {
      // 아직 시작 전이면 stop 이 던질 수 있다.
    }
    activeSource = null
  }

  /**
   * 원본 `0x6eaf0 resumeBgm` 의 몸통. 아래 `play` 도 효과음이 끝나면 이것을 밟는다.
   */
  const resumeRemembered = () => {
    if (rememberedBgmId === null || volume === 0) return
    playingBgmId = rememberedBgmId
    start(rememberedBgmId, true)
  }

  const start = (id: number, loop: boolean) => {
    const ctx = openContext()
    if (!ctx || !master) return
    playToken += 1
    const token = playToken
    stopActive()
    void loadBuffer(id, ctx).then((buffer) => {
      if (!buffer || token !== playToken || !master) return
      try {
        if (ctx.state === 'suspended') void ctx.resume()
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.loop = loop
        source.connect(master)
        if (!loop) {
          // ── 효과음이 끝나면 기억해 둔 배경음으로 돌아간다 ──
          // 원본은 통로가 하나뿐이라 효과음이 배경음을 끊고, **팝업이 끝나는 자리마다 손으로**
          // `0x6eaf0 resumeBgm` 을 부른다 (20여 곳). 웹은 효과음이 끝나는 시각을 브라우저가
          // 알려 주므로 그 자리를 여기서 자동으로 밟는다 — **이 되돌리기 시점은 근사다**.
          // 그래야 효과음 하나가 배경음을 영구히 죽이지 않는다.
          source.onended = () => {
            if (token !== playToken) return
            activeSource = null
            resumeRemembered()
          }
        }
        source.start()
        activeSource = source
      } catch {
        // 재생 실패는 진행을 막지 않는다.
      }
    })
  }

  return {
    play: (id) => {
      // 원본 0x6ea76: 볼륨 0 이면 재생하지 않는다. 반복이 아니면 번호도 기억하지 않는다.
      if (volume === 0) return
      playingBgmId = null
      start(id, false)
    },

    playBgm: (id) => {
      rememberedBgmId = id
      if (volume === 0) return
      if (playingBgmId === id && activeSource) return
      playingBgmId = id
      start(id, true)
    },

    stopBgm: () => {
      // 원본 0x6e438: 기억한 번호와 울리는 번호가 같을 때만 멈춘다.
      if (rememberedBgmId !== null && rememberedBgmId === playingBgmId) {
        stopActive()
        playingBgmId = null
      }
      rememberedBgmId = null
    },

    resumeBgm: resumeRemembered,

    currentBgm: () => rememberedBgmId,

    setVolume: (next) => {
      volume = clampVolume(next)
      if (master) {
        try {
          master.gain.value = volume / 100
        } catch {
          // 통로가 닫혔을 수 있다.
        }
      }
      if (volume === 0) {
        stopActive()
        playingBgmId = null
      }
    },

    getVolume: () => volume,
  }
}
