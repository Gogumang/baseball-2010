import { useCallback, useEffect, useRef, useState } from 'react'
import { applyPitchResolution, createAtBat } from '@/entities/at-bat/model/atBatState'
import type { AtBatState, PitchResolution } from '@/entities/at-bat/model/atBatState'

/** 타석이 끝난 뒤 결과를 보여주는 시간 */
const AT_BAT_BANNER_MILLISECONDS = 1500

export interface AtBatRunner {
  readonly atBat: AtBatState
  readonly bannerText: string
  readonly isPaused: boolean
  /**
   * 최신 타석. 캔버스 애니메이션 루프가 setState 업데이터 밖에서 읽어야 한다 —
   * 업데이터 안에서 다른 setState를 부르면 StrictMode가 업데이터를 두 번 실행해
   * 타석이 두 번 진행된다.
   */
  readonly atBatRef: { current: AtBatState }
  readonly setBannerText: (text: string) => void
  readonly setIsPaused: (isPaused: boolean) => void
  /** 공 하나를 반영하고 갱신된 타석을 돌려준다. */
  readonly applyPitch: (resolution: PitchResolution) => AtBatState
  /** 새 타석으로 되돌린다. */
  readonly resetAtBat: (count?: { balls: number; strikes: number }) => void
  /** 결과를 잠깐 띄운 뒤 새 타석으로 넘긴다. 뒷정리는 onElapsed가 맡는다. */
  readonly pauseWithBanner: (text: string, onElapsed?: () => void) => void
}

/** 타석 한 판의 공통 진행. 경기 모드와 미션 모드가 같이 쓴다. */
export function useAtBatRunner(): AtBatRunner {
  const [atBat, setAtBat] = useState<AtBatState>(() => createAtBat())
  const [bannerText, setBannerText] = useState('')
  const [isPaused, setIsPaused] = useState(false)

  const atBatRef = useRef(atBat)
  atBatRef.current = atBat

  const bannerTimerRef = useRef<number | null>(null)
  useEffect(
    () => () => {
      if (bannerTimerRef.current !== null) window.clearTimeout(bannerTimerRef.current)
    },
    [],
  )

  const resetAtBat = useCallback((count?: { balls: number; strikes: number }) => {
    atBatRef.current = createAtBat(count)
    setAtBat(atBatRef.current)
  }, [])

  const applyPitch = useCallback((resolution: PitchResolution) => {
    const next = applyPitchResolution(atBatRef.current, resolution)
    atBatRef.current = next
    setAtBat(next)
    return next
  }, [])

  const pauseWithBanner = useCallback(
    (text: string, onElapsed?: () => void) => {
      setIsPaused(true)
      setBannerText(text)

      if (bannerTimerRef.current !== null) window.clearTimeout(bannerTimerRef.current)
      bannerTimerRef.current = window.setTimeout(() => {
        resetAtBat()
        setBannerText('')
        if (onElapsed === undefined) {
          setIsPaused(false)
          return
        }
        onElapsed()
      }, AT_BAT_BANNER_MILLISECONDS)
    },
    [resetAtBat],
  )

  return {
    atBat,
    bannerText,
    isPaused,
    atBatRef,
    setBannerText,
    setIsPaused,
    applyPitch,
    resetAtBat,
    pauseWithBanner,
  }
}
