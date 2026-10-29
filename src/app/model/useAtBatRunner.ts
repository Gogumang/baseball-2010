import { useCallback, useEffect, useRef, useState } from 'react'
import { applyPitchResolution, createAtBat } from '@/entities/at-bat/model/atBatState'
import type { AtBatState, PitchResolution } from '@/entities/at-bat/model/atBatState'
import { clearGameSceneTimeout, setGameSceneTickTimeout } from '@/shared/lib/commonWindow/commonWindow'
import { RESULT_WAIT_TICKS_AT_BAT_END, resultWaitTicksOf } from '@/pages/game/lib/batterRecordAlert'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import { opensArrivalPlayAtOnce, type ArrivalPlayLike } from '@/features/play-game/model/benchClearingScene'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'

/**
 * **타석이 끝난 뒤 새 타석 0xd 까지 남은 그림 수** — 원본에는 따로 띄우는 "결과 띠" 상태가 없다. 타석을 끝내는 길은 둘뿐이다(R10 8절):
 * - **0x12 대기 끝 → 판정 A 0xae24c** (삼진 · 볼넷 · 사구): 갱신 0x4e6d4 머리 4e6de~4e6f0 이 st[0xb] ∈ {3, 4, 5} 면 문턱 0x1f 를
 *   잡고 4e72c~4e730 이 상태 틱 [+0x2c] ≥ 문턱인 갱신에서 A 를 부른다 → 0x12 진입부터 **32 그림** 뒤 0xd(볼넷 · 사구는 그 사이에
 *   밀어내기 판 0x17 을 한 번 거친다 — 판은 `useFreePassPlayStart` 가 같은 0x1f 틱 뒤에 세운다).
 * - **0x17 판 끝 → 판정 B 0xae3e8** (타구 · 파울 뜬공 · 도루/폭투 판 · 벤치 클리어링 뒤 밀어내기): 판이 끝난 그 갱신에서 0xd 를
 *   예약한다 → **0 그림**. 0x12 진입이 도루 · 폭투 판(종류 5 · 9)을 열면(0x3e096 · 0x3e114) 0x12 대기 없이 곧장 0x17 이라 이쪽이다.
 * 0x12 쪽은 `atBatEndFramesOf`, 판 끝은 0 을 넘긴다. 그동안 `bannerText` 가 서 있어 0xd · 0xe 대기(`useSceneConfirm`)가 안 센다.
 */
export const AT_BAT_END_AFTER_RESULT_WAIT_FRAMES = RESULT_WAIT_TICKS_AT_BAT_END + 1

/**
 * 0x12 진입에서 타석을 끝낸 공의 남은 그림 수 — 삼진 · 볼넷 · 사구(st[0xb] ∈ {3, 4, 5})이고 공 도착 판이 없거나 0x12 대기를 탄
 * 밀어내기(종류 2)면 0x12 대기 32 그림, 도루 · 폭투 판(종류 5 · 9)이 열렸거나 도루 출발 중 볼넷 · 사구의 밀어내기 판(A-24 —
 * 3e0e4 → 3e114)이면 곧장 0x17 이라 0 그림(판 끝에서 0xd, `opensArrivalPlayAtOnce`). 그 밖 결과(홈런 등 — 원본은 0x13 → 0x17 판)도
 * 0 그림이다. 판 끝에서 부르는 쪽은 판과 무관하게 0 이라 이 함수를 안 쓴다.
 */
export function atBatEndFramesOf(outcome: AtBatOutcome, arrivalPlay: ArrivalPlayLike | null | undefined): number {
  const waitsAtResult = resultWaitTicksOf(outcome) === RESULT_WAIT_TICKS_AT_BAT_END && !opensArrivalPlayAtOnce(arrivalPlay)
  return waitsAtResult ? AT_BAT_END_AFTER_RESULT_WAIT_FRAMES : 0
}

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
  /**
   * 결과를 `frames` 그림 동안 붙든 뒤 새 타석으로 넘긴다(`atBatEndFramesOf`). 뒷정리는 onElapsed가 맡는다.
   * 경기 장면 틱으로 센다(`setGameSceneTickTimeout`): 공용 창이 서 있는 동안(0x52c50 52cc6 이 장면 틱 · 갱신을 건너뛴다) 서고 닫히면 남은
   * 만큼 이어 센다. 끝은 장면 틱 격자의 틱 머리에 선다 — 타석 화면의 0x12 단계(장면 틱 − 시작 틱)와 같은 잣대다.
   */
  readonly pauseWithBanner: (text: string, frames: number, onElapsed?: () => void) => void
}

/** 타석 한 판의 공통 진행. 경기 모드와 미션 모드가 같이 쓴다. */
export function useAtBatRunner(): AtBatRunner {
  const [atBat, setAtBat] = useState<AtBatState>(() => createAtBat())
  const [bannerText, setBannerText] = useState('')
  const [isPaused, setIsPaused] = useState(false)

  const atBatRef = useRef(atBat)
  useMirrorRef(atBatRef, atBat)

  const bannerTimerRef = useRef<number | null>(null)
  useEffect(
    () => () => {
      clearGameSceneTimeout(bannerTimerRef.current)
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
    (text: string, frames: number, onElapsed?: () => void) => {
      setIsPaused(true)
      setBannerText(text)

      clearGameSceneTimeout(bannerTimerRef.current)
      bannerTimerRef.current = setGameSceneTickTimeout(() => {
        bannerTimerRef.current = null
        resetAtBat()
        setBannerText('')
        if (onElapsed === undefined) {
          setIsPaused(false)
          return
        }
        onElapsed()
      }, frames)
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
