import { useCallback, useEffect, useRef, useState } from 'react'
import { describePitchResolution } from '@/entities/at-bat/model/resolutionText'
import { derbyBattedBallOf } from '@/entities/home-run-derby/model/derbyBattedBall'
import { derbyPitcherOf } from '@/entities/home-run-derby/model/derbyPitcher'
import type { DerbyPitcher } from '@/entities/home-run-derby/model/derbyPitcher'
import {
  COMBO_DISPLAY_FRAMES,
  applyDerbyPitch,
  createDerbyRun,
  derbyResultOf,
  endComboDisplay,
  shouldShowComboAtNextPitch,
} from '@/entities/home-run-derby/model/derbyRun'
import type { DerbyResult, DerbyRun } from '@/entities/home-run-derby/model/derbyRun'
import { isEventZoneHit } from '@/entities/home-run-derby/model/eventZone'
import type { PitchOutcomeDetail } from '@/features/play-at-bat/model/resolvePitch'
import { LOSE_SOUND, WIN_SOUND } from '@/features/play-game/model/gameSounds'
import { activeSound, playSoundIds } from '@/shared/api/audio/soundPort'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { rollSimulatorInit } from '@/entities/game/model/simulatorInit'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

/** 공 하나의 결과를 보여 주는 시간 — 타석 화면들이 쓰는 값과 같다 (원본에 없는 웹판 연출) */
const BANNER_MILLISECONDS = 1_500

export interface HomeRunDerbyOptions {
  /** 저장된 최고 비거리 (저장 +0x5c, u16) */
  readonly bestDistance: number
  /** 10구(+보너스)가 다 끝났을 때 한 번 불린다 — 최고 기록·G 를 저장할 곳에 알린다 */
  readonly onFinish?: (result: DerbyResult) => void
  /**
   * 마선수 레벨 열 칸 (전역 `mgr[0x13a..0x143]`). 단계 1~4 난입 마투수가 능력치 배율
   * 0xd88aa(0xb6414) 로 이 칸을 본다 — `derbyPitcherOf` 머리말.
   */
  readonly aceLevels?: Readonly<Record<number, number>>
  /**
   * 경기 장면 시작 굴림을 낼 난수 (`rollDerbySceneStart`). 안 넘기면 굴리지 않는다 (예전 시험용).
   */
  readonly random?: RandomPort
}

/**
 * **홈런더비 경기 시작 굴림 둘** — 상태 9 갱신 0x3f584 의 공통 꼬리 차례 그대로:
 * ```
 * 3f856  0x39fdc(scene, 7)  → 모드 7 갈래 3a43e:
 *          3a44e  r7 = (s8) 0x1f8d5(저장, 4)+1          ; 내 타자편 팀
 *          3a454  v = rand(0, 9) → sp+0x18 ; v == r7 이면 9   ; 상대 팀 — 0xb6bd5(ctx, 1, v) · 팀 객체 0xb891c
 * 3fa0e  0xc0dac 시뮬 초기화 → c0df6 rand(0, 2)          ; `rollSimulatorInit` (dcfcef7)
 * ```
 * ⚠️ 뽑은 상대 팀(수비 팀)은 웹 더비가 그리지 않아 버린다 — 굴림 차례만 맞춘다.
 */
export function rollDerbySceneStart(random: RandomPort): void {
  random.nextInRange(0, 9)
  rollSimulatorInit(random)
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
  /**
   * HUD 콤보 표시(장면 +0x1b60)가 켜져 있으면 그리는 값(+0x84), 아니면 null.
   * 다음 공 준비(상태 0xf)에서 켜져 `COMBO_DISPLAY_FRAMES` 갱신 뒤 꺼진다 (`0x3dbf8` · `0x4585c`).
   */
  readonly shownCombo: number | null
  /** 판이 끝났으면 결과, 아니면 null */
  readonly result: DerbyResult | null
  readonly onPitchResolved: (detail: PitchOutcomeDetail) => void
  readonly restart: () => void
}

/**
 * 홈런더비 한 판의 진행 (H-2).
 *
 * 원본은 공 하나가 끝날 때마다 0xae24c(맞지 않은 공 — 상태 0x12 끝 0x4e78c)·0xae3e8(맞은 공 — 인플레이 0x17 끝 0x52a52)
 * 로 들어가 기회를 하나 쓴다 — 두 함수의 모드 7 갈래는 볼카운트를 건드리지 않으므로(0xae26a · 0xae408 에서 일반 갈래로 안 간다)
 * **던진 공은 무엇이든 기회 한 번**이다. 그래서 볼카운트가 없다.
 *
 * **번트**도 같다 (90408d8 로 키가 열렸다): 번트 판정 0x51226(0x51108 안)·타구 시작 0x51408 에 모드 갈림이 없고,
 * 맞은 번트(파울 포함)는 인플레이 끝에서 0xae3e8 로 와 "홈런 아닌 공" 하나가 된다 — 기회 −1 · 비거리 0 · 직전 홈런이면 콤보 0.
 * 맞지 않은 번트는 0xae24c 로 같은 셈이다. 번트를 따로 다루는 갈래는 없다. 그래서 여기서도 `detail.isBunt` 를 보지 않는다.
 *
 * 비거리는 원본이 타구 궤적의 착지점에서 잰다(0xa600c) — 타석(`resolvePitch`)이 실제로 뽑은 패턴
 * (`detail.pattern`)을 `derbyBattedBallOf` 가 `battedBallFlight` 궤적으로 만든다 (그 파일 머리말 참고).
 */
export function useHomeRunDerby({ bestDistance, onFinish, aceLevels, random }: HomeRunDerbyOptions): HomeRunDerbySession {
  const [run, setRun] = useState<DerbyRun>(createDerbyRun)
  const [banner, setBanner] = useState('')
  const [isPaused, setIsPaused] = useState(false)
  const [isEventZoneShown, setIsEventZoneShown] = useState(false)
  const [shownCombo, setShownCombo] = useState<number | null>(null)
  const [result, setResult] = useState<DerbyResult | null>(null)

  // 캔버스 루프에서 불리는 콜백이라 최신 값은 전부 ref 로 읽는다 (StrictMode 가 업데이터를 두 번 돌린다)
  const runRef = useRef(run)
  runRef.current = run
  const bestRef = useRef(bestDistance)
  bestRef.current = bestDistance
  const onFinishRef = useRef(onFinish)
  onFinishRef.current = onFinish
  const randomRef = useRef(random)
  randomRef.current = random

  // 장면에 들어선 첫 그림 뒤 한 번 — 첫 공(상태 0xd → 투구)보다 앞이다. StrictMode 의 효과 두 번 돌기에도 한 번만
  const isSceneStartRolledRef = useRef(false)
  useEffect(() => {
    if (isSceneStartRolledRef.current || randomRef.current === undefined) return
    isSceneStartRolledRef.current = true
    rollDerbySceneStart(randomRef.current)
  }, [])

  const timerRef = useRef<number | null>(null)
  const clearTimer = () => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current)
    timerRef.current = null
  }
  /** HUD 콤보 표시(+0x1b60)가 꺼질 때 — 상태 0xf 에서 켠 뒤 21 번 그리면 끈다 */
  const comboTimerRef = useRef<number | null>(null)
  const clearComboTimer = () => {
    if (comboTimerRef.current !== null) window.clearTimeout(comboTimerRef.current)
    comboTimerRef.current = null
  }
  useEffect(() => () => {
    clearTimer()
    clearComboTimer()
  }, [])

  const audio = activeSound()
  const audioRef = useRef(audio)
  audioRef.current = audio

  /** 0x45a0c~0x45a18 — 콤보 표시를 끄고 +0x84 = 0 */
  const endShownCombo = () => {
    clearComboTimer()
    const ended = endComboDisplay(runRef.current)
    runRef.current = ended
    setRun(ended)
    setShownCombo(null)
  }

  const onPitchResolved = useCallback((detail: PitchOutcomeDetail) => {
    // 원본은 공 하나가 상태 0xf 에서 21 갱신 안에 끝날 수 없어 표시는 늘 그 전에 꺼진다 — 웹 타이머가 늦으면 여기서 먼저 끈다
    if (comboTimerRef.current !== null) endShownCombo()
    const current = runRef.current
    if (current.isFinished) return

    // 상대 투수 투구 소모(0x3dec6 → 0xa5e14)는 모드를 가리지 않아 홈런더비에서도 돌지만 **결과에 닿지 않는다** —
    // 체력%를 읽는 0xaebb0 이 모드 7 이면 늘 100 을 돌려준다 (0xaebbc `cmp r3,#7` → `movs r0,#0x64`).
    // 그래서 CPU 제구 등급(0x4dbac)·피로(0xb58e6)·교체(0xac428) 모두 지치지 않은 투수로 본다.
    // `detail.pitchTypeNumber` 로 깎을 칸을 두지 않는다.

    // **타구 순간 소리** (0x515de~0x5164a) — 강 5 · 보통 6 · 약 59 · 큰 타구 7 · 헛스윙 8.
    // 고르는 것은 `features/play-at-bat/model/atBatSounds` 가 이미 했고 여기는 울리기만 한다.
    // ⚠️ 심판 콜은 안 낸다 — 홈런더비는 볼·스트라이크를 세지 않아(H-2) 판정 스위치가 보는
    //    볼카운트 자체가 없고, 어느 갈래로 들어가는지도 문서에 없다.
    playSoundIds(audioRef.current, [detail.contactSoundId])

    const isHomeRun = detail.resolution.kind === '타구' && detail.resolution.outcome.kind === '홈런'
    const batted = detail.pattern === undefined ? null : derbyBattedBallOf(detail.pattern, isHomeRun)
    // 이벤트 존은 "공이 날아가는 중" 조건이라 배트에 맞은 공에서만 본다 (0x36dfc) — 패턴 플래그 & 2 (+0x127)
    const zoneHit = isEventZoneHit({ pattern: detail.pattern ?? null })

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
    // 콤보 문구는 지운 뒤의 콤보(+0x39)가 아니라 **표시값 +0x84** 를 본다 — 원본 HUD 0x4585c 가 읽는 칸이다.
    // 원본은 이 값을 다음 공 준비(상태 0xf)에서 띄우므로, 판이 끝나 0xf 를 안 지나면(마지막 공) 띄우지 않는다.
    // 그래서 보너스 게임을 여는 마지막 정규 공 홈런은 콤보(+0x39)가 0 이어도 올린 콤보를 띄운다.
    if (shouldShowComboAtNextPitch(next)) parts.push(`${next.comboDisplay} COMBO`)
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
      // 다음 공 준비(상태 0xf) 0x3dbf8 — +0x84 > 0 이면 HUD 콤보 표시를 켠다(+0x1b60 = 1 · +0x19ec = 0).
      // 단계가 오르거나 보너스 게임을 열 때(0xae3e8 → 상태 0xd)도 **0xf 를 지난다 (확정, U-89)**:
      //   0xd 갱신 0x39e14 — 틱 > 0 이고 점수판 [+0xf10]+0x6c ≠ 1 이면 0xe (모드 갈림 없음)
      //   0xe 진입 0x50674 — 강판 0x504cc 는 모드 3 이 아니면 늘 0(0x504de) → 0x23 으로 안 샌다
      //   0xe 키 0x532b0 — OK(−5·'5') → 메시지 1 → 0x50c18: 인자 0xe 면 상태 0xf (돌발 객체 +0xf28 이 있고 0x8f158 참일 때만 0x1b → 0xf)
      //   0xf 진입 0x3d954 → 0x3db92~0x3dbf2(모드 7 애니 되돌리기) · 0x3dbf8(+0x84 > 0 → 표시 켜기)
      // (예전 근거 "0x48d50 의 0x49846" 은 0x49846 이 교체 화면 키 0x495fc 안이라 틀린 주소였다.)
      // ⚠️ 원본은 0xe 에서 사람 OK 를 기다리지만 웹 더비에는 그 확인 단계가 없어 결과 연출이 끝나면 곧바로 0xf 로 본다.
      if (shouldShowComboAtNextPitch(runRef.current)) {
        setShownCombo(runRef.current.comboDisplay)
        clearComboTimer()
        comboTimerRef.current = window.setTimeout(endShownCombo, COMBO_DISPLAY_FRAMES * millisecondsPerFrame())
      }
    }, BANNER_MILLISECONDS)
  }, [])

  const restart = useCallback(() => {
    clearTimer()
    // 경기 시작 상태 9 의 0x39868 이 +0x84 · 표시(+0x1b60) · +0x19ec 를 지운다
    clearComboTimer()
    setShownCombo(null)
    // 다시하기도 경기 장면을 새로 세운다 — 같은 시작 굴림 둘 (⚠️ 다시하기가 상태 7 → 9 를 다시 타는지는 유력)
    if (randomRef.current !== undefined) rollDerbySceneStart(randomRef.current)
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
    pitcher: derbyPitcherOf(run.stage, aceLevels),
    banner,
    isPaused,
    isEventZoneShown,
    shownCombo,
    result,
    onPitchResolved,
    restart,
  }
}
