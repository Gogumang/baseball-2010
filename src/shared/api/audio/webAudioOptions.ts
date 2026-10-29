import { tryOr } from '@/shared/lib/safe/tryOr'

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

// 시험 DOM 에는 AudioContext 가 없다. 못 열면 소리 없이 계속 간다.
export const defaultCreateContext: AudioContextFactory = () =>
  tryOr(() => {
    const global = globalThis as unknown as MaybeAudioContextCtor
    const Ctor = global.AudioContext ?? global.webkitAudioContext
    return Ctor ? new Ctor() : null
  }, null)

export const defaultFetchAudio = async (url: string): Promise<ArrayBuffer> => {
  const response = await fetch(url)
  return await response.arrayBuffer()
}

/**
 * 자동화 브라우저(Playwright 시험)에서는 소리를 내보내지 않는다 — 시험 중 음악이 나오지 않게.
 * 재생 로직은 그대로 돌고 마지막 출력 크기만 0 이다. 테스트가 통로를 갈아 끼우면 적용하지 않는다.
 */
export const isAutomatedBrowser = (): boolean => globalThis.navigator?.webdriver === true

export const clampVolume = (volume: number): number => {
  if (!Number.isFinite(volume)) return 0
  return Math.max(0, Math.min(100, Math.round(volume)))
}
