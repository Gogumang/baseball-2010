import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import type { DerbyRun } from '@/entities/home-run-derby/model/derbyRun'
import { clearSceneParticles } from '@/entities/particle/model/sceneParticleManager'
import { playSoundIds, type SoundPort } from '@/shared/api/audio/soundPort'
import { clearGameSceneTimeout, setGameSceneTickTimeout } from '@/shared/lib/commonWindow/commonWindow'
import { CONFIRM_LOCK_FRAMES, DERBY_AT_BAT_ENTRY_SOUND, SCENE_D_FRAMES } from './derbySceneFrames'

/** 경기 장면 시계 하나 — 건 것을 지우고 새로 건다 */
function useSceneTickTimer() {
  const timerRef = useRef<number | null>(null)
  const clear = useCallback(() => {
    if (timerRef.current !== null) clearGameSceneTimeout(timerRef.current)
    timerRef.current = null
  }, [])
  const arm = useCallback(
    (callback: () => void, ticks: number) => {
      clear()
      timerRef.current = setGameSceneTickTimeout(() => {
        timerRef.current = null
        callback()
      }, ticks)
    },
    [clear],
  )
  return [arm, clear] as const
}

/**
 * **상태 0xd(타석 준비) → 0xe(사람 OK 대기)**. 경기 첫 공 앞(적재 8 → 0xd, 0x3fa50)·단계가 올라 새 마투수가 설 때·보너스 게임을
 * 열 때(0xae3e8/0xae24c → 0xd) 0xd 를 지나 0xe 로 온다. 0xe 는 시간 제한·자동 진행이 없다 — 갱신 0x39bd4 는 모드 7 이면
 * 아무것도 안 하고(0x39bde `cmp r3,#7`), CPU 조작 객체 0x53874 는 0xf·0x10·0x11 만 본다.
 * 첫 0xd 진입도 같은 0x48d50 이다 — 게임 길은 단계 0 이라 0, 단계 바로가기면 그 단계 마투수(첫 0xd 는 시계만 걸어 `enterSceneD` 를 안 지난다)
 */
export function useDerbyConfirmWait(
  initialStage: number,
  runRef: RefObject<DerbyRun>,
  audioRef: RefObject<SoundPort>,
  isLoadingRef: RefObject<boolean>,
  closeLoading: () => boolean,
  confirmNextBatter: () => void,
  enterNextPitch: () => void,
) {
  /** 마운드에 선 투수의 단계 — 상태 0xd 진입 0x48d50 이 마투수를 복사할 때만 바뀐다 */
  const [moundStage, setMoundStage] = useState(initialStage)
  /** 볼 수 st[5] — 0xd 진입 0x48e9c(0xb6764)만 지운다 (`derbyPitchCallOf`) */
  const ballsRef = useRef(0)
  // 경기 시작: 적재 상태 8 끝이 모드 7 이면 미리 넣어 둔 0xd 로 간다(0x3fa4c~0x3fa50 · R10 0x48b20) → 0x39e14 → 0xe
  const [isPreparing, setIsPreparing] = useState(true)
  /** 상태 0xd 진입 번호 — 타석 화면이 이때만 좌우 이동을 되돌린다(0x48d50 48f88) */
  const [sceneDSerial, setSceneDSerial] = useState(0)
  const [isAwaitingConfirm, setIsAwaitingConfirm] = useState(false)
  const isAwaitingConfirmRef = useRef(false)
  /** 상태 0xe 의 키 잠금(틱 ≤ 2)이 풀렸나 */
  const isConfirmUnlockedRef = useRef(false)
  const [armConfirmLockTimer, clearConfirmLockTimer] = useSceneTickTimer()
  /** 상태 0xd — `SCENE_D_FRAMES` 갱신 뒤 0xe 로 간다 (0x39e14) */
  const [armPrepareTimer, clearPrepareTimer] = useSceneTickTimer()

  /** 상태 0xd → 0xe 로 들어선다 — OK 를 기다린다. 들어선 뒤 `CONFIRM_LOCK_FRAMES` 갱신이 지나야 OK 를 받는다 */
  const enterConfirmWait = useCallback(() => {
    isAwaitingConfirmRef.current = true
    setIsAwaitingConfirm(true)
    isConfirmUnlockedRef.current = false
    armConfirmLockTimer(() => {
      isConfirmUnlockedRef.current = true
    }, CONFIRM_LOCK_FRAMES)
  }, [armConfirmLockTimer])

  const armScenePrepare = useCallback(() => {
    // 0xd 첫 그림 — 0x48d50 의 48ecc 메시지 0xbc1 → 0x522d2 의 타석 등장음(모드 갈림 없음). 더비의 0xd 는 첫 공 앞 ·
    // 단계가 오를 때 · 보너스를 열 때뿐이라 교체 연출 0x16 을 안 거친다. 타자는 모드 타자(나리 · 명전 기록 — 마선수 비트 0x40 없음)라
    // 26 이 아니고, 주자를 두는 판이 없어 14 다.
    // 볼넷 · 사구 뒤에도 주자가 안 선다 (2026-10-14 직접 떴다): 판정 v3 · v4(0x3e1ae · 0x3e1b4)는 플레이 종류만 2 로 두고
    // (0xb0cb8(플레이, 2)), 주자를 루에 세우는 것은 0x12 끝 0xae24c 의 일반 갈래 ae344~ae35c(st[0xb] 3 · 4 → 상태 0x17)다.
    // 모드 7 은 ae270 `cmp 7` 에서 ae274~ae336(기회 셈 → 0xd 또는 0x1a)으로 갈라 0x17 을 안 지난다 → 0xa97a1(2·3루)이 늘 거짓이라
    // 15 가 아니라 늘 14 다. 웹 더비에 주자 칸이 없는 것도 원본 그대로다
    clearPrepareTimer()
    playSoundIds(audioRef.current, [DERBY_AT_BAT_ENTRY_SOUND])
    armPrepareTimer(() => {
      setIsPreparing(false)
      enterConfirmWait()
    }, SCENE_D_FRAMES)
  }, [armPrepareTimer, audioRef, clearPrepareTimer, enterConfirmWait])

  /**
   * 상태 0xd 진입 0x48d50 — 모드 7 · 단계 > 0 이면 마투수 표 0xcfce8[단계 − 1] 레코드를 지금 투수에 0x30 바이트 복사(48d8e~48dd4),
   * 다음 타순 확정(48ddc), 볼카운트 지우기 0x48e9c(`0xb6764`). 아직 OK 를 받지 않는다. 로딩 판이 서 있으면 시계는 `finishLoading` 이 건다
   */
  const enterScenePrepare = useCallback(() => {
    // 48f88 — 좌우 이동 +0xfe4 = 0. 공 사이(0xf)에서는 안 지운다 (`shiftResetSerial`)
    setSceneDSerial((serial) => serial + 1)
    // 48ef8~48f04 — 이전 상태가 0x16 이 아니면 파티클 관리자를 비운다(0x6dee4). 더비의 0xd 는 0x16 을 안 거친다
    clearSceneParticles()
    setMoundStage(runRef.current.stage)
    confirmNextBatter()
    ballsRef.current = 0
    isAwaitingConfirmRef.current = false
    clearConfirmLockTimer()
    setIsAwaitingConfirm(false)
    setIsPreparing(true)
    if (isLoadingRef.current) clearPrepareTimer()
    else armScenePrepare()
  }, [armScenePrepare, clearConfirmLockTimer, clearPrepareTimer, confirmNextBatter, isLoadingRef, runRef])

  // 첫 공 앞의 0xd — 시계만 건다 (StrictMode 의 효과 두 번 돌기에도 같은 결과다). 로딩 판이 서 있으면 다 그린 뒤
  useEffect(() => {
    if (!isLoadingRef.current) armScenePrepare()
  }, [armScenePrepare, isLoadingRef])
  useEffect(
    () => () => {
      clearConfirmLockTimer()
      clearPrepareTimer()
    },
    [clearConfirmLockTimer, clearPrepareTimer],
  )

  /** 로딩 판(상태 7 · 9 · 8)을 다 그렸다 — 적재 8 끝이 모드 7 이면 0xd 로(0x3fa4c~0x3fa50) → 두 그림 뒤 0xe. 굴림 없음 */
  const finishLoading = useCallback(() => {
    if (closeLoading()) armScenePrepare()
  }, [armScenePrepare, closeLoading])

  /**
   * 0xe 의 OK — 사람 조작 객체 키 0x532b0: 키 == −5(OK) 또는 '5'(0x35) 이면 메시지 1(인자 = 지금 상태 0xe) →
   * 0x50c18 이 상태 0xf 를 예약한다. 0xe 에 들어선 뒤 `CONFIRM_LOCK_FRAMES` 갱신 안에는 무시한다.
   */
  const confirm = useCallback(() => {
    if (!isAwaitingConfirmRef.current || !isConfirmUnlockedRef.current) return
    // 메시지 1 → 0x50c18: 인자 0xe 면 0xf 예약. 돌발 객체 +0xf28 은 홈런더비에 없어(돌발미션은 모드 1·2·4 — `gameFlow`) 0x1b 로 안 샌다
    isAwaitingConfirmRef.current = false
    clearConfirmLockTimer()
    setIsAwaitingConfirm(false)
    enterNextPitch()
  }, [clearConfirmLockTimer, enterNextPitch])

  return { moundStage, ballsRef, isPreparing, sceneDSerial, isAwaitingConfirm, enterScenePrepare, finishLoading, confirm }
}
