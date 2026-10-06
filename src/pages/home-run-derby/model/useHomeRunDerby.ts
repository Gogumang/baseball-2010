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
  derbySceneStateAfter,
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

/**
 * 상태 0xe 에 들어선 뒤 OK 를 안 받는 갱신 수 — 키 처리 0x498d4 끝(0x49a26~0x49a30)이
 * `[장면+0x1c] == 0xe && [장면+0x2c](이 상태의 틱) ≤ 2` 이면 사람 조작 객체에 키를 넘기지 않는다.
 * 진입 틱이 0 이라 틱 0·1·2 셋을 거른다 (확정: 상태 기계 0xbc9c8 이 상태를 바꾸는 그림에서 +0x14(= 장면+0x2c) = 0,
 * 그대로면 +0x14++ — 매 그림 0x52c50 이 0xbc9c8 → 진입 → 키 0x498d4 → 갱신 → 그리기 차례로 부른다).
 */
export const CONFIRM_LOCK_FRAMES = 3

/**
 * 상태 0xd 가 머무는 갱신 수 — 갱신 0x39e14 는 `[점수판 +0xf10]+0x6c ≠ 1 && 틱 > 0` 이면 0xe 를 예약한다.
 * 점수판 +0x6c 는 1 이 되는 일이 없다: 쓰는 곳이 만들기 0x76b16(0) · 0xd 진입 0x48f42(2, +0x61 == 0 일 때) ·
 * 점수판 갱신 0x785a8(1 → 2 0x785c8 · 2·3 → 0 0x78626 · 4·5 → 0 0x78650) 뿐이다(전체 디스어셈 `str …, #0x6c]` 전수,
 * 0x785a8 이 받는 객체는 0x41230 의 [장면+0xf10]). 그래서 늘 **틱 0(진입)·틱 1(예약)** 두 그림 뒤 0xe 다.
 */
export const SCENE_D_FRAMES = 2

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
  /** 결과를 보여 주는 동안·상태 0xe 에서 OK 를 기다리는 동안은 새 공을 안 던진다 */
  readonly isPaused: boolean
  /**
   * **상태 0xe — 사람 OK 를 기다리는 중**. 경기 첫 공 앞(적재 8 → 0xd, 0x3fa50)·단계가 올라 새 마투수가 설 때·보너스 게임을
   * 열 때(0xae3e8/0xae24c → 0xd) 0xd 를 지나 0xe 로 온다. 0xe 는 시간 제한·자동 진행이 없다 — 갱신 0x39bd4 는 모드 7 이면
   * 아무것도 안 하고(0x39bde `cmp r3,#7`), CPU 조작 객체 0x53874 는 0xf·0x10·0x11 만 본다.
   */
  readonly isAwaitingConfirm: boolean
  /**
   * 0xe 의 OK — 사람 조작 객체 키 0x532b0: 키 == −5(OK) 또는 '5'(0x35) 이면 메시지 1(인자 = 지금 상태 0xe) →
   * 0x50c18 이 상태 0xf 를 예약한다. 다른 키는 아무 일도 안 한다. 0xe 에 들어선 뒤 `CONFIRM_LOCK_FRAMES` 갱신 안에는 무시한다.
   */
  readonly confirm: () => void
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
  /** 경기 중 메뉴 [다시하기] 예 — 새 경기 장면 (0x3c98e 모드 7 갈래, `restart` 머리말) */
  readonly restart: () => void
  /** 결과 창 [예] — 단계 > 0 이면 rand(1, 4) 를 하나 더 굴린 뒤 `restart` 와 같다 (0x40a08) */
  readonly retryFromResult: () => void
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
  // 경기 시작: 적재 상태 8 끝이 모드 7 이면 미리 넣어 둔 0xd 로 간다(0x3fa4c~0x3fa50 · R10 0x48b20) → 0x39e14 → 0xe
  const [isPreparing, setIsPreparing] = useState(true)
  const [isAwaitingConfirm, setIsAwaitingConfirm] = useState(false)
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
  /** 상태 0xe 의 키 잠금(틱 ≤ 2)이 풀렸나 */
  const isConfirmUnlockedRef = useRef(false)
  const confirmLockTimerRef = useRef<number | null>(null)
  const clearConfirmLockTimer = () => {
    if (confirmLockTimerRef.current !== null) window.clearTimeout(confirmLockTimerRef.current)
    confirmLockTimerRef.current = null
  }
  /** 0xe 의 키 잠금 시계 — 들어선 뒤 `CONFIRM_LOCK_FRAMES` 갱신이 지나야 OK 를 받는다 */
  const armConfirmLock = () => {
    clearConfirmLockTimer()
    isConfirmUnlockedRef.current = false
    confirmLockTimerRef.current = window.setTimeout(() => {
      confirmLockTimerRef.current = null
      isConfirmUnlockedRef.current = true
    }, CONFIRM_LOCK_FRAMES * millisecondsPerFrame())
  }
  /** 상태 0xd → 0xe 로 들어선다 — OK 를 기다린다 */
  const enterConfirmWait = () => {
    isAwaitingConfirmRef.current = true
    setIsAwaitingConfirm(true)
    armConfirmLock()
  }
  const isAwaitingConfirmRef = useRef(isAwaitingConfirm)

  /** 상태 0xd — `SCENE_D_FRAMES` 갱신 뒤 0xe 로 간다 (0x39e14) */
  const prepareTimerRef = useRef<number | null>(null)
  const clearPrepareTimer = () => {
    if (prepareTimerRef.current !== null) window.clearTimeout(prepareTimerRef.current)
    prepareTimerRef.current = null
  }
  const armScenePrepare = () => {
    clearPrepareTimer()
    prepareTimerRef.current = window.setTimeout(() => {
      prepareTimerRef.current = null
      setIsPreparing(false)
      enterConfirmWait()
    }, SCENE_D_FRAMES * millisecondsPerFrame())
  }
  /** 상태 0xd 로 들어선다 — 아직 OK 를 받지 않는다 */
  const enterScenePrepare = () => {
    isAwaitingConfirmRef.current = false
    clearConfirmLockTimer()
    setIsAwaitingConfirm(false)
    setIsPreparing(true)
    armScenePrepare()
  }

  // 첫 공 앞의 0xd — 시계만 건다 (StrictMode 의 효과 두 번 돌기에도 같은 결과다)
  useEffect(() => {
    armScenePrepare()
  }, [])

  useEffect(() => () => {
    clearTimer()
    clearComboTimer()
    clearConfirmLockTimer()
    clearPrepareTimer()
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

  /**
   * 다음 공 준비(상태 0xf) 진입 0x3d954 — 0x3dbf8: +0x84 > 0 이면 HUD 콤보 표시를 켠다(+0x1b60 = 1 · +0x19ec = 0).
   * 0x3db92~0x3dbf2(모드 7 애니 되돌리기)는 `DerbyHud` 가 표시를 켤 때 첫 칸부터 그리는 것으로 갈음한다.
   */
  const enterNextPitch = () => {
    if (shouldShowComboAtNextPitch(runRef.current)) {
      setShownCombo(runRef.current.comboDisplay)
      clearComboTimer()
      comboTimerRef.current = window.setTimeout(endShownCombo, COMBO_DISPLAY_FRAMES * millisecondsPerFrame())
    }
  }

  const confirm = useCallback(() => {
    if (!isAwaitingConfirmRef.current || !isConfirmUnlockedRef.current) return
    // 메시지 1 → 0x50c18: 인자 0xe 면 0xf 예약. 돌발 객체 +0xf28 은 홈런더비에 없어(돌발미션은 모드 1·2·4 — `gameFlow`) 0x1b 로 안 샌다
    isAwaitingConfirmRef.current = false
    clearConfirmLockTimer()
    setIsAwaitingConfirm(false)
    enterNextPitch()
  }, [])

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
    // 0xae3e8/0xae24c 가 돌려주는 다음 상태 — 0xd(→ 0xe OK 대기) · 0xf · 0x1a
    const nextSceneState = derbySceneStateAfter(current, next)
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
        // 결과에는 기록달성 목록이 없다: 0x4f710 `0x22e10` 은 나리 타자편 버퍼(0x328c8 0x213c0(mgr, 4, 0))의 이번 경기 칸을
        // 더하는데, 더비 중엔 a780a(state[1] = 7)가 기록을 막고 game_br.sav 의 그 칸은 늘 0 이라 0 마흔이다 (annalsStats 머리말)
        onFinishRef.current?.(finished)
        return
      }
      setIsPaused(false)
      // 단계가 오르거나 보너스 게임을 열 때(0xae3e8 → 상태 0xd)는 0xe 에서 **사람 OK 를 기다린 뒤** 0xf 를 지난다 (확정, U-89):
      //   0xd 갱신 0x39e14 — 틱 > 0 이고 점수판 [+0xf10]+0x6c ≠ 1 이면 0xe (모드 갈림 없음)
      //   0xe 진입 0x50674 — 강판 0x504cc 는 모드 3 이 아니면 늘 0(0x504de) → 0x23 으로 안 샌다
      //   0xe 갱신 0x39bd4 — 모드 7 이면 아무것도 안 한다 (시간 제한·자동 진행 없음)
      //   0xe 키 0x532b0 — OK(−5·'5') → 메시지 1 → 0x50c18: 인자 0xe 면 상태 0xf (돌발 객체 +0xf28 이 있고 0x8f158 참일 때만 0x1b → 0xf)
      //   0xf 진입 0x3d954 → 0x3db92~0x3dbf2(모드 7 애니 되돌리기) · 0x3dbf8(+0x84 > 0 → 표시 켜기)
      // (예전 근거 "0x48d50 의 0x49846" 은 0x49846 이 교체 화면 키 0x495fc 안이라 틀린 주소였다.)
      //   0xd 는 늘 두 그림(`SCENE_D_FRAMES`) 머문다 — 점수판 +0x6c 는 1 이 되는 일이 없다.
      // 0xe 그리기 0x4d9ec 는 0xd 그리기에 0x44944(투수·타자 소개 판)를 더 그린다 — 화면이 `isAwaitingConfirm` 동안 띄운다.
      if (nextSceneState === 0xd) {
        enterScenePrepare()
        return
      }
      // 보통 공(0xf)은 곧바로 다음 공 준비다
      enterNextPitch()
    }, BANNER_MILLISECONDS)
  }, [])

  /**
   * **다시하기 = 경기 장면을 새로 세운다 (확정)**. 경기 중 메뉴 [다시하기](0x3c706 → StrGAME[7] 질문 → 하위 3) 의 예
   * 처리 0x3c98e: `0x20094(앱, 5)` · 장면+0x17f9 = 1 → 모드 7 이면(0x3c9d2) 전역 0x140006c = 0x27 · `0xbc291(…, 0x103)`
   * (0x3c9d8~0x3c9e8) — 결과 창 [예](0x40a98) 와 같은 길이다. 메인 메뉴 하위 0x27 → 0x32988 → 0x327b8(this, 7) →
   * 경기 장면 0x104 를 새로 만들고, 그 초기화 0x3301c 가 `0xbcb49(장면+0x18, 7)`(0x330fe)로 **상태 7 → 9 → 8 → 0xd** 를
   * 처음부터 탄다 — 시작 굴림 rand(0, 9) · rand(0, 2) 도 다시 돈다(U-79 확정). 0x20094 모드 5 갈래(0x1ff98)에는 굴림이 없다.
   */
  const restart = useCallback(() => {
    clearTimer()
    // 경기 시작 상태 9 의 0x39868 이 +0x84 · 표시(+0x1b60) · +0x19ec 를 지운다
    clearComboTimer()
    setShownCombo(null)
    // 경기 시작과 같이 적재 8 → 0xd → 0xe 로 와서 OK 를 기다린다
    enterScenePrepare()
    // 새 경기 장면의 상태 9 — 같은 시작 굴림 둘
    if (randomRef.current !== undefined) rollDerbySceneStart(randomRef.current)
    const fresh = createDerbyRun()
    runRef.current = fresh
    setRun(fresh)
    setBanner('')
    setIsPaused(false)
    setIsEventZoneShown(false)
    setResult(null)
  }, [])

  /**
   * 결과 창 [예] 0x40a08 (0x40a54~0x40a98): +0x17f9(예) 이고 단계 state+0x38 > 0 이면
   * `r = rand(1, 4)` → `0xb89dc([장면+0x224], r)` 기록 0x30 바이트를 지금 투수 `0xae83c([장면+0x224])` 에 복사한 뒤 0x27.
   * ⚠️ 복사는 웹에 상대 팀 기록이 없어 굴림 차례만 맞춘다 (뜻은 미해결 — 마투수로 덮인 상대 투수 칸을 팀의 r 번째 투수로 되돌리는 것으로 보인다).
   */
  const retryFromResult = useCallback(() => {
    if (runRef.current.stage > 0 && randomRef.current !== undefined) randomRef.current.nextInRange(1, 4)
    restart()
  }, [restart])

  return {
    run,
    pitcher: derbyPitcherOf(run.stage, aceLevels),
    banner,
    isPaused: isPaused || isPreparing || isAwaitingConfirm,
    isAwaitingConfirm,
    confirm,
    isEventZoneShown,
    shownCombo,
    result,
    onPitchResolved,
    restart,
    retryFromResult,
  }
}
