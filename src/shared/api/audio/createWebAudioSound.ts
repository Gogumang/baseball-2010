import type { SoundPort } from '@/shared/api/audio/soundPort'
import { soundFileUrl } from '@/shared/config/original/sounds'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'
import { ignoreErrors, tryOr, tryOrAsync } from '@/shared/lib/safe/tryOr'
import {
  clampVolume,
  defaultCreateContext,
  defaultFetchAudio,
  isAutomatedBrowser,
  type WebAudioSoundOptions,
} from '@/shared/api/audio/webAudioOptions'

/**
 * 소리 포트 하나 — 통로 · 기억한 배경음 · 소리 크기를 닫힌 함수 칸에 둔다(원본 사운드 객체 +0x14 · +0x28 · +0x2c 와 같은 꼴, 원래 모양 그대로).
 * 자동화 브라우저면 마지막 출력 크기만 0 이다(`isAutomatedBrowser`).
 */
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
