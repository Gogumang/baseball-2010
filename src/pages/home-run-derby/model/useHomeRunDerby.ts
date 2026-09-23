import { useCallback, useEffect, useRef, useState } from 'react'
import { describePitchResolution } from '@/entities/at-bat/model/resolutionText'
import { derbyBattedBallOf } from '@/entities/home-run-derby/model/derbyBattedBall'
import { derbyPitcherOf } from '@/entities/home-run-derby/model/derbyPitcher'
import type { DerbyPitcher } from '@/entities/home-run-derby/model/derbyPitcher'
import { applyDerbyPitch, createDerbyRun, derbyResultOf } from '@/entities/home-run-derby/model/derbyRun'
import type { DerbyResult, DerbyRun } from '@/entities/home-run-derby/model/derbyRun'
import { isEventZoneHit } from '@/entities/home-run-derby/model/eventZone'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { LOSE_SOUND, WIN_SOUND } from '@/features/play-game/model/gameSounds'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { activeSound, playSoundIds } from '@/shared/api/audio/soundPort'

/** 공 하나의 결과를 보여 주는 시간 — 타석 화면들이 쓰는 값과 같다 (원본에 없는 웹판 연출) */
const BANNER_MILLISECONDS = 1_500

export interface HomeRunDerbyOptions {
  readonly random: RandomPort
  /** 저장된 최고 비거리 (저장 +0x5c, u16) */
  readonly bestDistance: number
  /** 10구(+보너스)가 다 끝났을 때 한 번 불린다 — 최고 기록·G 를 저장할 곳에 알린다 */
  readonly onFinish?: (result: DerbyResult) => void
}

export interface HomeRunDerbySession {
  readonly run: DerbyRun
  readonly pitcher: DerbyPitcher
  /** 공 하나가 끝난 뒤 띄우는 문구. 비어 있으면 안내 줄을 보여 준다 */
  readonly banner: string
  /** 결과를 보여 주는 동안은 새 공을 안 던진다 */
  readonly isPaused: boolean
  /** 이번 공이 이벤트 존을 얻었나 — 존 그림을 띄우는 동안만 참이다 */
  readonly isEventZoneShown: boolean
  /** 판이 끝났으면 결과, 아니면 null */
  readonly result: DerbyResult | null
  readonly onPitchResolved: (detail: PitchOutcomeDetail) => void
  readonly restart: () => void
}

/**
 * 홈런더비 한 판의 진행 (H-2).
 *
 * 원본은 공 하나가 끝날 때마다 0xae24c(아웃·헛스윙)·0xae3e8(타구)로 들어가 기회를 하나 쓴다 —
 * 볼·스트라이크를 세지 않으므로 **던진 공은 무엇이든 기회 한 번**이다. 그래서 볼카운트가 없다.
 *
 * 비거리는 원본이 타구 궤적의 착지점에서 재는데(0xa600c), 이식판 `resolvePitch` 는 자기가 뽑은
 * 패턴을 내보내지 않는다 — `derbyBattedBallOf` 가 같은 결과 코드의 원본 패턴을 한 장 골라
 * `battedBallFlight` 로 궤적을 만든다 (근사, 그 파일 머리말 참고).
 */
export function useHomeRunDerby({ random, bestDistance, onFinish }: HomeRunDerbyOptions): HomeRunDerbySession {
  const [run, setRun] = useState<DerbyRun>(createDerbyRun)
  const [banner, setBanner] = useState('')
  const [isPaused, setIsPaused] = useState(false)
  const [isEventZoneShown, setIsEventZoneShown] = useState(false)
  const [result, setResult] = useState<DerbyResult | null>(null)

  // 캔버스 루프에서 불리는 콜백이라 최신 값은 전부 ref 로 읽는다 (StrictMode 가 업데이터를 두 번 돌린다)
  const runRef = useRef(run)
  runRef.current = run
  const randomRef = useRef(random)
  randomRef.current = random
  const bestRef = useRef(bestDistance)
  bestRef.current = bestDistance
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish

  const timerRef = useRef<number | null>(null)
  const clearTimer = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
  }
  useEffect(() => () => clearTimer(), [])

  const audio = activeSound()
  const audioRef = useRef(audio)
  audioRef.current = audio

  const onPitchResolved = useCallback((detail: PitchOutcomeDetail) => {
    const current = runRef.current
    if (current.isFinished) return

    // **타구 순간 소리** (0x515de~0x5164a) — 강 5 · 보통 6 · 약 59 · 큰 타구 7 · 헛스윙 8.
    // 고르는 것은 `features/play-at-bat/model/atBatSounds` 가 이미 했고 여기는 울리기만 한다.
    // ⚠️ 심판 콜은 안 낸다 — 홈런더비는 볼·스트라이크를 세지 않아(H-2) 판정 스위치가 보는
    //    볼카운트 자체가 없고, 어느 갈래로 들어가는지도 문서에 없다.
    playSoundIds(audioRef.current, [detail.contactSoundId])

    const isHomeRun = detail.resolution.kind === '타구' && detail.resolution.outcome.kind === '홈런'
    const batted = detail.resultCode === null ? null : derbyBattedBallOf(detail.resultCode, isHomeRun, randomRef.current)
    // 이벤트 존은 "공이 날아가는 중" 조건이라 배트에 맞은 공에서만 본다 (0x36dfc)
    const zoneHit = batted !== null && isEventZoneHit({ apexHeight: batted.apexHeight })

    const next = applyDerbyPitch(current, {
      isHomeRun,
      distance: batted?.distance ?? 0,
      isEventZoneHit: zoneHit,
    })
    runRef.current = next
    setRun(next)
    setIsEventZoneShown(zoneHit)

    const parts = [describePitchResolution(detail.resolution)]
    if (isHomeRun) parts.push(`${next.lastDistance}M`)
    if (next.combo > 0) parts.push(`${next.combo} COMBO`)
    if (zoneHit) parts.push('EVENT ZONE!')
    setBanner(parts.join(' · '))
    setIsPaused(true)

    clearTimer()
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null
      setBanner('')
      setIsEventZoneShown(false)
      if (runRef.current.isFinished) {
        const finished = derbyResultOf(runRef.current, bestRef.current)
        setResult(finished)
        // 결과 창(상태 0x1a) 진입 0x4f574 — 누적 > 저장 +0x5c 면 신기록 0x1f(31), 아니면 0x20(32)
        // 을 예약한다 (R14 1-2 · L 1-F). 승패 징글과 **같은 번호를 나눠 쓰는 자리**다
        playSoundIds(audioRef.current, [finished.isNewRecord ? WIN_SOUND : LOSE_SOUND])
        onFinishRef.current?.(finished)
        return
      }
      setIsPaused(false)
    }, BANNER_MILLISECONDS)
  }, [])

  const restart = useCallback(() => {
    clearTimer()
    const fresh = createDerbyRun()
    runRef.current = fresh
    setRun(fresh)
    setBanner('')
    setIsPaused(false)
    setIsEventZoneShown(false)
    setResult(null)
  }, [])

  return {
    run,
    pitcher: derbyPitcherOf(run.stage),
    banner,
    isPaused,
    isEventZoneShown,
    result,
    onPitchResolved,
    restart,
  }
}
