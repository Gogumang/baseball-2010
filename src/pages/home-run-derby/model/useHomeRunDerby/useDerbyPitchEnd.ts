import { useCallback, useEffect, useRef, useState, type Dispatch, type RefObject, type SetStateAction } from 'react'
import { rollsIntoBenchClearing } from '@/entities/game/model/benchClearing'
import { rollBenchClearingEntry, rollBenchClearingTargets } from '@/features/play-game/model/benchClearingScene'
import type { BenchClearingEntryRoll } from '@/features/play-game/model/benchClearingScene'
import type { DerbyBattedBall } from '@/entities/home-run-derby/model/derbyBattedBall'
import { applyDerbyPitch, derbySceneStateAfter } from '@/entities/home-run-derby/model/derbyRun'
import type { DerbyRun } from '@/entities/home-run-derby/model/derbyRun'
import type { SoundPort } from '@/shared/api/audio/soundPort'
import { clearGameSceneTimeout, gameSceneTickNow, setGameSceneTickTimeout } from '@/shared/lib/commonWindow/commonWindow'
import { DERBY_DISTANCE_HIDDEN_ID, DERBY_DISTANCE_HIDDEN_THRESHOLD } from './derbySceneFrames'
import type { HomeRunDerbyOptions } from './homeRunDerbyTypes'
import { useDerbyResultEntry } from './useDerbyResultEntry'

/**
 * **공 하나의 끝** — 판(0x17) 끝(관문이 닫힌 뒤 10틱 → 0xbb9 → 0xae3e8) · 0x12 대기 끝(0xae24c)의 셈과 다음 상태(0xf · 0xd · 0x1a),
 * 사구 뒤 벤치 클리어링(0x1e). 원본은 공 하나가 끝날 때마다 0xae24c · 0xae3e8 로 들어가 기회를 하나 쓴다.
 */
export function useDerbyPitchEnd(
  optionsRef: RefObject<HomeRunDerbyOptions>,
  audioRef: RefObject<SoundPort>,
  runRef: RefObject<DerbyRun>,
  setRun: Dispatch<SetStateAction<DerbyRun>>,
  setSkyRow: Dispatch<SetStateAction<number | undefined>>,
  enterScenePrepare: () => void,
  enterNextPitch: () => void,
  endPlay: (openHidden: () => boolean) => boolean,
  leavePlay: () => void,
) {
  /** 결과를 보여 주는 동안·상태 0xe 에서 OK 를 기다리는 동안은 새 공을 안 던진다 */
  const [isPaused, setIsPaused] = useState(false)
  /** 벤치 클리어링(상태 0x1e) 중인가 */
  const [isBenchClearing, setIsBenchClearing] = useState(false)
  /** 진입 0x3a5f0 의 굴림 45 번 — 그리기 0x43228 이 공격 9명을 세운다 */
  const [benchClearingEntryRolls, setBenchClearingEntryRolls] = useState<readonly BenchClearingEntryRoll[] | null>(null)
  const isBenchClearingRef = useRef(false)
  /** 이번 공이 사구(판정 v4)였나 — 0x12 대기 끝의 벤치 클리어링 굴림 조건 */
  const isHitByPitchRef = useRef(false)
  /** 0xae3e8/0xae24c 가 돌려주는 다음 상태 — 0xd(→ 0xe OK 대기) · 0xf · 0x1a */
  const nextSceneStateRef = useRef<number>(0xf)
  const [result, showResult, clearResult] = useDerbyResultEntry(optionsRef, audioRef, setSkyRow)
  const timerRef = useRef<number | null>(null)
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) clearGameSceneTimeout(timerRef.current)
    timerRef.current = null
  }, [])
  useEffect(() => clearTimer, [clearTimer])

  /**
   * 0xae3e8/0xae24c 모드 7 갈래 — 이 판의 홈런 · 비거리로 진행을 셈한다. 셈은 판 시작에 미리 해 두고(난수를 안 쓴다)
   * 화면 칸(`run`)은 판 끝 `finishPitch` 에서 맞춘다.
   */
  const applyPlayResult = useCallback(
    (before: DerbyRun, batted: DerbyBattedBall | null, zoneHit: boolean) => {
      const next = applyDerbyPitch(before, {
        isHomeRun: batted?.isHomeRun ?? false,
        distance: batted?.distance ?? 0,
        displayDistance: batted?.displayDistance ?? null,
        isEventZoneHit: zoneHit,
      })
      nextSceneStateRef.current = derbySceneStateAfter(before, next)
      runRef.current = next
    },
    [runRef],
  )

  /** 0xae3e8 · 0xae24c 를 지난 뒤 — 화면 칸을 셈에 맞추고 다음 상태(0xf · 0xd · 0x1a)로 */
  const finishPitch = useCallback(() => {
    // 0xae3e8 · 0xae24c — 기회 · 공 번호 · 누적 · 콤보 칸이 여기서 바뀐다
    setRun(runRef.current)
    if (runRef.current.isFinished) {
      showResult(runRef.current)
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
    if (nextSceneStateRef.current === 0xd) {
      enterScenePrepare()
      return
    }
    // 보통 공(0xf)은 곧바로 다음 공 준비다
    enterNextPitch()
  }, [enterNextPitch, enterScenePrepare, runRef, setRun, showResult])

  /**
   * 0x12 갱신 0x4e740~0x4e776 — 사구(st[0xb] == 4)면 플레이 종류 [+0x118] 은 v4 의 0xb0cb8(플레이, 2) 가 쓴 2 라 8(더비 판) 검사에
   * 안 걸린다 → 더비도 rand(0, 99) ≤ 19 면 벤치 클리어링(0x1e). 돌발 객체는 더비에 없다. 들어갔으면 참
   */
  const rollBenchClearingAfterHitByPitch = useCallback(() => {
    if (!isHitByPitchRef.current) return false
    isHitByPitchRef.current = false
    const scene = optionsRef.current.random
    if (scene === undefined || !rollsIntoBenchClearing({ isHitByPitch: true, isHomeRunDerby: false, burstInProgress: false }, scene)) return false
    // 진입 0x3a5f0 — 공격 9명 굴림 45 번 (`rollBenchClearingEntry`). 꼬리 0x3ab4a~ 의 수비 CPU 투구 수 +10 · 평판 0xa755c 는
    // 더비에 보이는 곳이 없다(체력% 0xaebb0 은 모드 7 이면 늘 100 · 기록은 a780a 가 막는다)
    setBenchClearingEntryRolls(rollBenchClearingEntry(scene))
    isBenchClearingRef.current = true
    setIsBenchClearing(true)
    return true
  }, [optionsRef])

  /**
   * 판 끝 · 0x12 대기 끝 시계 — 장면 틱 `dueTick` 의 틀 머리(지났으면 다음 틀 머리). 0x17 끝 0xbcb48 은 다음 상태 칸 [장면+0x18+8] 만
   * 적고 다음 틀 머리 52cd8 0xbc9c8 이 지금 칸 [+0x1c] 로 옮긴다 — 그래서 판이 끝난 그림의 그리기(52f3a 표 0xd05a0[0x17 − 9] = 0x46c88)까지는 0x17 이다.
   *
   * 52a00~52a16 — 판(0x17) 끝, 0x35108 · 0xae3e8 앞에서 누적 비거리 st+0x34 > 1999 면 히든 39. 누적은 판 안 0xa600c 가 이미 더했다
   * (웹은 판 시작에 셈해 둔 `runRef`). 맞지 않은 공(0x12)은 이 갈래를 안 지난다. **창이 선 그림의 그리기 — 판(0x17)의 필드 화면이 창 뒤에 남는다**
   * (2026-10-26 직접 떴다, r299): 52a16 0x62368 → 0x74ef4 가 창을 세우고 [창+0x250] = 1 · 52a54 0xae3e8 이 다음 상태를 돌려주고 52ab2
   * 0xbcb48(장면+0x18, 다음) — +8 = 다음 · +0x18 = 1 만 적는다(지금 +4 그대로) · 52efe [+0x250] = 1 이라 그리기를 건너뛰지 않는다 → 52f3a
   * [장면+0x1c] = 아직 0x17 → 0x46c88(+ 앞의 0x41230 구장 · 이벤트 존). 다음 그림부터 52cc6 이 0xbc9c8(상태 옮기기) · 갱신을, 52efe 가
   * 그리기를 건너뛰어 그 그림이 남는다. 0x46c88 은 모드 7 이라 비거리 판 0x36cd4(판 종류 8 이면 늘) · 야수 · 공 · 존을 그리고, HOMERUN
   * 0x40b18(46e2e~46e5c)은 관문 0xb0d28 이 닫혀(판 끝은 관문이 닫힌 뒤 11 번째 갱신) 안 그린다. 파티클은 53048 이 창 동안 건너뛴다.
   * 타석 화면 0x4c4bc(HUD)는 없다. 창을 닫으면 그 다음 틀 머리가 다음 상태(0xf · 0xd · 0x1a)로 옮겨 진입 · 그리기를 한다 — 웹은 닫힘에서 `finishPitch`
   */
  const armPlayEnd = useCallback(
    (dueTick: number) => {
      clearTimer()
      const ticks = dueTick - gameSceneTickNow()
      const openHidden = () =>
        runRef.current.totalDistance > DERBY_DISTANCE_HIDDEN_THRESHOLD &&
        optionsRef.current.onOpenHidden?.(DERBY_DISTANCE_HIDDEN_ID, () => {
          leavePlay()
          finishPitch()
        }) === true
      timerRef.current = setGameSceneTickTimeout(() => {
        timerRef.current = null
        if (endPlay(openHidden)) return
        if (rollBenchClearingAfterHitByPitch()) return
        finishPitch()
      }, ticks)
    },
    [clearTimer, endPlay, finishPitch, leavePlay, optionsRef, rollBenchClearingAfterHitByPitch, runRef],
  )

  /** 공이 끝났다 — 결과 연출 동안 새 공을 안 던지고 `dueTick` 에 공 하나의 셈으로 간다. 사구면 그 끝에 벤치 클리어링 굴림 */
  const awaitPitchEnd = useCallback(
    (dueTick: number, isHitByPitch: boolean) => {
      setIsPaused(true)
      isHitByPitchRef.current = isHitByPitch
      armPlayEnd(dueTick)
    },
    [armPlayEnd],
  )

  /** 벤치 클리어링 출구 0xae24c — 틱 10 이 돌았으면 수비 목표 굴림 8 번(0x401d4)을 낸 뒤 보통 길(0xae24c)을 간다 */
  const finishBenchClearing = useCallback(
    (reachedTargetTick: boolean) => {
      if (!isBenchClearingRef.current) return
      isBenchClearingRef.current = false
      setIsBenchClearing(false)
      const random = optionsRef.current.random
      if (reachedTargetTick && random !== undefined) rollBenchClearingTargets(random)
      finishPitch()
    },
    [finishPitch, optionsRef],
  )

  /** 새 장면 — 걸린 공 끝 시계 · 벤치 클리어링 연출 · 결과 창을 버린다 */
  const resetPitchEnd = useCallback(() => {
    clearTimer()
    isHitByPitchRef.current = false
    isBenchClearingRef.current = false
    setIsBenchClearing(false)
    setIsPaused(false)
    clearResult()
  }, [clearResult, clearTimer])

  const state = { isPaused, isBenchClearing, benchClearingEntryRolls, result }
  return { state, applyPlayResult, awaitPitchEnd, armPlayEnd, finishBenchClearing, resetPitchEnd }
}
