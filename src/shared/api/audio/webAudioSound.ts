import type { SoundPort } from '@/shared/api/audio/soundPort'
import { soundFileUrl } from '@/shared/config/original/sounds'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { ignoreErrors, tryOr, tryOrAsync } from '@/shared/lib/safe/tryOr'

/**
 * WebAudio 로 `public/sounds/%03d.mp3` 를 트는 포트 구현.
 *
 * 파일은 `tools/extract_sounds.py` 가 원본 `sound/%03d.mmf`(야마하 SMAF) 에서 구워 둔 것이다.
 * 브라우저는 SMAF 를 직접 못 읽어서 미리 굽는 길을 골랐다 (docs/re/L-sound-effects.md 1-D).
 *
 * `AudioContext` 가 없는 환경(jsdom·서버 렌더)에서는 **아무 소리도 내지 않고 조용히 넘어간다**.
 * 소리가 안 나는 것 때문에 게임이 멈추면 안 되므로 모든 접근을 예외 삼키기(`shared/lib/safe`)로 감쌌다.
 *
 * 효과음은 배경음을 끊고 **끝나도 배경음으로 돌아오지 않는다** — 원본 그대로다 (`SoundPort` 머리 주석:
 * 틱 0x6eb18 의 되돌리기 갈래는 0x6eb30 `[+0x4c] == 0` 으로 죽어 있고, `resumeBgm` 0x6eaf0 은 통신 화면만 부른다).
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

// jsdom 에는 AudioContext 가 없다. 못 열면 소리 없이 계속 간다.
const defaultCreateContext: AudioContextFactory = () =>
  tryOr(() => {
    const global = globalThis as unknown as MaybeAudioContextCtor
    const Ctor = global.AudioContext ?? global.webkitAudioContext
    return Ctor ? new Ctor() : null
  }, null)

const defaultFetchAudio = async (url: string): Promise<ArrayBuffer> => {
  const response = await fetch(url)
  return await response.arrayBuffer()
}

/**
 * 자동화 브라우저(Playwright 시험)에서는 소리를 내보내지 않는다 — 시험 중 음악이 나오지 않게.
 * 재생 로직은 그대로 돌고 마지막 출력 크기만 0 이다. 테스트가 통로를 갈아 끼우면 적용하지 않는다.
 */
const isAutomatedBrowser = (): boolean => globalThis.navigator?.webdriver === true

const clampVolume = (volume: number): number => {
  if (!Number.isFinite(volume)) return 0
  return Math.max(0, Math.min(100, Math.round(volume)))
}

export function createWebAudioSound(options: WebAudioSoundOptions = {}): SoundPort {
  const baseUrl = options.baseUrl ?? assetUrl('sounds')
  const createContext = options.createContext ?? defaultCreateContext
  const fetchAudio = options.fetchAudio ?? defaultFetchAudio
  const silentOutput = options.createContext === undefined && isAutomatedBrowser()
  const outputGainOf = (level: number): number => (silentOutput ? 0 : level / 100)

  let volume = clampVolume(options.volume ?? 100)
  let context: AudioContext | null = null
  let contextOpened = false
  let master: GainNode | null = null

  /** 번호 → 디코드한 소리. 실패도 기억해 두어 같은 파일을 계속 다시 받지 않는다. */
  const buffers = new Map<number, Promise<AudioBuffer | null>>()

  /** 원본은 통로가 하나뿐이라 새 소리가 울리던 소리를 끊는다. */
  let activeSource: AudioBufferSourceNode | null = null
  /** 마지막에 물린 소리가 반복(배경음)이었나 — 원본 미디어 +0x11 비트 0 (`stop` 이 본다) */
  let lastLoop = false
  /** 늦게 도착한 소리가 이미 지나간 장면에서 울리지 않게 하는 표 */
  let playToken = 0

  /** 원본 +0x28 — 기억해 둔 배경음 */
  let rememberedBgmId: number | null = null
  /** 원본 +0x2c — 지금 울리는 배경음 */
  let playingBgmId: number | null = null
  /**
   * 원본 +0x2c 그대로 — 0x6ea6c 가 **반복을 가리지 않고** 적는다(r197 직접 뜸): 볼륨 0 이면 6ea8a `+0x2c = −1`, 물리면
   * 6eaae `+0x2c = n`. 볼륨 0 으로 내리는 0x6e4d0 은 미디어(+0x14)만 끊고(0x6e258) 이 칸은 안 건드린다 — 소리 단축키 0x2ddc 가
   * 0 → 1 로 켤 때 이 번호(1~4)를 다시 튼다 (`lastPlayed`)
   */
  let lastPlayedId: number | null = null

  const openContext = (): AudioContext | null => {
    if (contextOpened) return context
    contextOpened = true
    context = tryOr(createContext, null)
    if (context) {
      const opened = context
      master = tryOr(() => {
        const gain = opened.createGain()
        gain.gain.value = outputGainOf(volume)
        gain.connect(opened.destination)
        return gain
      }, null)
      if (master === null) context = null
    }
    return context
  }

  const loadBuffer = (id: number, ctx: AudioContext): Promise<AudioBuffer | null> => {
    const cached = buffers.get(id)
    if (cached) return cached
    // 파일이 없거나 브라우저가 못 읽는다 — 그 소리만 조용히 빠진다.
    const loading = tryOrAsync(async () => {
      const bytes = await fetchAudio(soundFileUrl(id, baseUrl))
      return await ctx.decodeAudioData(bytes)
    }, null)
    buffers.set(id, loading)
    return loading
  }

  const stopActive = () => {
    if (!activeSource) return
    const source = activeSource
    // 아직 시작 전이면 stop 이 던질 수 있다.
    ignoreErrors(() => source.stop())
    activeSource = null
  }

  /** 원본 `0x6eaf0 resumeBgm` 의 몸통 */
  const resumeRemembered = () => {
    if (rememberedBgmId === null || volume === 0) return
    playingBgmId = rememberedBgmId
    lastPlayedId = rememberedBgmId
    start(rememberedBgmId, true)
  }

  const start = (id: number, loop: boolean) => {
    const ctx = openContext()
    if (!ctx || !master) return
    playToken += 1
    const token = playToken
    lastLoop = loop
    stopActive()
    void loadBuffer(id, ctx).then((buffer) => {
      if (!buffer || token !== playToken || !master) return
      const output = master
      // 재생 실패는 진행을 막지 않는다.
      ignoreErrors(() => {
        if (ctx.state === 'suspended') void ctx.resume()
        const source = ctx.createBufferSource()
        source.buffer = buffer
        source.loop = loop
        source.connect(output)
        // 효과음이 끝나면 통로가 비기만 한다 — 기억한 배경음을 스스로 되돌리지 않는다 (머리 주석)
        source.onended = () => {
          if (token !== playToken) return
          activeSource = null
        }
        source.start()
        activeSource = source
      })
    })
  }

  return {
    play: (id) => {
      // 원본 0x6ea76: 볼륨 0 이면 재생하지 않는다. 반복이 아니면 번호도 기억하지 않는다.
      if (volume === 0) {
        lastPlayedId = null
        return
      }
      playingBgmId = null
      lastPlayedId = id
      start(id, false)
    },

    playBgm: (id) => {
      // 원본 0x6ea6c 는 번호를 견주지 않는다 — 같은 번호가 울리고 있어도 0x6e9d4 가 끊고 처음부터 튼다
      rememberedBgmId = id
      if (volume === 0) {
        lastPlayedId = null
        return
      }
      playingBgmId = id
      lastPlayedId = id
      start(id, true)
    },

    stopBgm: () => {
      // 원본 0x6e438: 기억한 번호와 울리는 번호가 같을 때만 멈춘다.
      if (rememberedBgmId !== null && rememberedBgmId === playingBgmId) {
        // 아직 받는 중인 배경음도 울리지 않게 표를 넘긴다
        playToken += 1
        stopActive()
        playingBgmId = null
      }
      rememberedBgmId = null
    },

    stop: () => {
      // 원본 0x6e418: 물린 소리가 반복이면 기억한 배경음도 잊고, 지금 소리를 끊는다. 아직 받는 중인 소리도 울리지 않게 표를 넘긴다
      if (lastLoop) rememberedBgmId = null
      playToken += 1
      stopActive()
    },

    resumeBgm: resumeRemembered,

    currentBgm: () => rememberedBgmId,

    setVolume: (next) => {
      volume = clampVolume(next)
      const output = master
      // 통로가 닫혔을 수 있다.
      if (output) ignoreErrors(() => (output.gain.value = outputGainOf(volume)))
      if (volume === 0) {
        stopActive()
        playingBgmId = null
      }
    },

    getVolume: () => volume,

    lastPlayed: () => lastPlayedId,

    suspendOutput: () => {
      // 0x6e690 → [0x1400598](6, 1) — 단말 쪽 미디어를 멈춘다. 사운드 객체 칸(+0x28 · +0x2c)은 안 건드린다.
      // 아직 받는 중인 소리도 울리지 않게 표를 넘긴다
      playToken += 1
      stopActive()
    },
  }
}
