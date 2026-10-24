import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { activeSound } from '@/shared/api/audio/soundPort'
import { clearSceneParticles } from '@/entities/particle/model/sceneParticleManager'
import {
  clearGameSceneTimeout, gameSceneTickNow, isGameSceneFrozen, setGameSceneTickTimeout,
} from '@/shared/lib/commonWindow/commonWindow'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'

/**
 * 상태 0xe 에 들어선 뒤 OK 를 안 받는 갱신 수 — 키 처리 0x498d4 끝(0x49a26~0x49a30)이
 * `[장면+0x1c] == 0xe && [장면+0x2c](이 상태의 틱) ≤ 2` 이면 사람 조작 객체에 키를 넘기지 않는다.
 * 진입 틱을 0 으로 세어 틱 0·1·2 셋을 거른다 (홈런더비 `CONFIRM_LOCK_FRAMES` 와 같은 값·같은 근거).
 */
export const SCENE_CONFIRM_LOCK_FRAMES = 3

/**
 * 0xd(타석 준비)에 머무는 갱신 수 — 갱신 0x39e14 는 `틱 > 0 && 점수판 [+0xf10]+0x6c ≠ 1` 이면 0xe 를 예약하고(다음 틱에 옮긴다),
 * 점수판 +0x6c 는 1 이 되는 일이 없어 늘 두 그림 머문다 (4c09530 확정). 0xd 의 OK 는 사람 조작 0x536bc 의 점프표(0xe~0x1a)
 * 밖이라 아무 일도 없다.
 */
export const SCENE_PREPARE_FRAMES = 2

/** 대기가 보이기 시작해 OK 를 처음 받을 수 있게 되기까지 — 0xd 두 그림 + 0xe 잠금 세 그림 */
export const SCENE_CONFIRM_READY_FRAMES = SCENE_PREPARE_FRAMES + SCENE_CONFIRM_LOCK_FRAMES

/** 0xe 의 OK — 원본 키 −5(OK)·'5'(0x35) (0x532b0). 웹은 Enter·스페이스도 OK 로 받는다 (타석 화면 스윙 키와 같은 묶음) */
const CONFIRM_KEYS: ReadonlySet<string> = new Set(['Enter', ' ', '5'])

/** 타석 등장음을 이미 낸 대기 — 화면이 다시 서도(메뉴를 열었다 닫아도) 두 번 안 낸다 */
const announcedWaits = new WeakSet<SceneConfirmWait>()

/**
 * 0xd 첫 그림을 이미 센 (대기, 받은 OK 수) — 같은 0xd 를 화면이 다시 서도(메뉴를 열었다 닫아도) 두 번 세지 않는다
 */
const enteredSceneD = new WeakMap<SceneConfirmWait, Set<number>>()

/** (대기, 받은 OK 수)의 0xd 를 처음 본다면 적고 참 */
function marksSceneDEntered(wait: SceneConfirmWait, confirmed: number): boolean {
  const seen = enteredSceneD.get(wait) ?? new Set<number>()
  if (seen.has(confirmed)) return false
  seen.add(confirmed)
  enteredSceneD.set(wait, seen)
  return true
}

/** 0xd 두 그림 · 0xe 한 그림을 다 지난 강판 지나감(`hooksAtEntry`) — 화면이 다시 서도 남는다 */
const passedHookWaits = new WeakSet<SceneConfirmWait>()

/** 강판 지나감의 0xe — 그리기 표가 0x4d9ec 를 한 번 돈 뒤 다음 틀 0xbc9c8 이 0x23 으로 옮긴다 */
const HOOK_PASSAGE_CONFIRM_FRAMES = 1

/** 대기 객체마다 받은 OK 수 — 화면이 다시 서도 남는다 (진행 상태가 같은 객체를 들고 있는 동안) */
const confirmedCounts = new WeakMap<SceneConfirmWait, number>()

/** OK 를 받을 때마다 부른다 — 대기를 화면 밖에서 보는 쪽(`useIsSceneConfirmAwaiting`)이 다시 그린다 */
const confirmListeners = new Set<() => void>()
const subscribeConfirm = (listener: () => void) => {
  confirmListeners.add(listener)
  return () => {
    confirmListeners.delete(listener)
  }
}

/** 대기 객체가 지금까지 받은 OK 수 — 교체 연출(`useSubstitutionScene`)이 "몇 번째 OK 뒤" 를 본다 */
export function confirmedCountOf(wait: SceneConfirmWait | null | undefined): number {
  return wait == null ? 0 : (confirmedCounts.get(wait) ?? 0)
}

/** 대기 객체가 아직 OK 를 다 못 받았는가 */
export function isSceneConfirmAwaiting(wait: SceneConfirmWait | null | undefined): boolean {
  if (wait == null) return false
  if (wait.hooksAtEntry === true) return !passedHookWaits.has(wait)
  return (confirmedCounts.get(wait) ?? 0) < wait.entries
}

/**
 * 화면 밖(경로 부품)에서 대기를 본다 — OK 뒤에 서는 창(나리 타자편 돌발 제안 0x1b)을 OK 를 다 받을 때까지 미룬다.
 * OK 는 화면의 `useSceneConfirm` 이 받는다.
 */
export function useIsSceneConfirmAwaiting(wait: SceneConfirmWait | null | undefined): boolean {
  return useSyncExternalStore(subscribeConfirm, () => isSceneConfirmAwaiting(wait), () => isSceneConfirmAwaiting(wait))
}

export interface SceneConfirm {
  /** 상태 0xd·0xe — 사람 OK 를 기다리는 중 (메뉴가 떠 있어도 참이다) */
  readonly isAwaiting: boolean
  /**
   * 0xd 두 그림을 지나 **0xe 에 들어섰는가** — 0xe 그리기 0x4d9ec 의 투수·타자 소개 판 0x44944(`MatchupCards`)는 이때부터
   * 그린다(판의 틱은 0xe 에 들어선 그림이 0)
   */
  readonly isInConfirmState: boolean
  /** 지금 OK 를 받는 중인가 — 기다리는 중이고 화면이 받을 수 있을 때 (`canAccept`) */
  readonly acceptsConfirm: boolean
  /** OK 한 번 — 받을 수 없으면(잠금 3 갱신·메뉴 등) 아무 일도 없다 */
  readonly confirm: () => void
  /**
   * 0xd 진입(0x48d50)마다 오르는 표지 — 대기가 보이기 시작한 0xd 첫 그림에 오른다. 교체 창 0xb 에서 곧장 선 0xe(`skipsSceneD`)는
   * 안 오른다. 사람 투구 장면(`PitcherSideStage`)이 48ee4 0x35650 → 0x340c0(투수 그림 객체 상태 0)을 여기에 잇는다
   */
  readonly sceneDEntryMark: number
}

/**
 * **상태 0xe 의 OK 대기** — 진행기가 실어 둔 대기 객체(`SceneConfirmWait`)를 보고 OK 를 센다.
 *
 * - `canAccept` 가 거짓이면(경기 중 메뉴·조작방법·설정·교대 판·인트로가 덮고 있으면) 키를 안 받는다 — 일시정지 팝업
 *   0x754f9 가 떠 있으면 경기 키가 안 가고, 0x498d4 의 OK 는 0xe 의 사람 조작 객체에게만 간다.
 * - 받기 시작하면 0xd 두 그림(`SCENE_PREPARE_FRAMES`) 뒤 0xe 로 보고, 그 뒤 `SCENE_CONFIRM_LOCK_FRAMES` 갱신 안의 OK 는
 *   무시한다 (0x49a26). ⚠️ 근사: 원본은 0xd 에 들어선 때부터 센다. 웹은 화면이 받기 시작한 때(덮개가 걷힌 때)부터 센다.
 * - 셈은 경기 장면 시계로 한다(`setGameSceneTimeout`): 공용 창(경기 중 메뉴 · 조작방법 · 설정 · 히든 오픈 알림)이 서 있으면
 *   0x52c50 52cc6 이 장면 틱 0xbc9c9([장면+0x2c]) · 키 0x498d4 를 건너뛰어 0xd 두 그림 · 0xe 잠금 셈이 서고, 닫히면 그 자리에서
 *   이어 센다. 그래서 창이 덮어 `canAccept` 가 잠시 거짓이 되어도(창이 서 있는 채로 내려갔다가) 같은 대기로 돌아오면 처음부터
 *   다시 세지 않고 멈춘 자리에서 잇는다. 창이 서 있는 동안 OK 는 받지 않는다(키는 창 0x754f9 가 가져간다).
 * - Enter·스페이스·'5' 를 OK 로 받는다. 화면 누르기는 부르는 쪽이 `confirm` 을 잇는다.
 */
export function useSceneConfirm(
  wait: SceneConfirmWait | null | undefined,
  canAccept: boolean,
  /**
   * OK 를 받을 때마다 — OK 뒤 굴림(메시지 1 의 돌발 0x8f158 · 0xf 진입 0x3d954)을 그때 돌리는 진행기(팀경기·투수편)가 잇는다
   */
  onConfirm?: () => void,
): SceneConfirm {
  const [, setVersion] = useState(0)
  const confirmed = wait == null ? 0 : (confirmedCounts.get(wait) ?? 0)
  const isAwaiting = isSceneConfirmAwaiting(wait)
  /** 0xd · 0xe 를 세는 중 — 강판 지나감(`hooksAtEntry`)도 센다 */
  const isCounting = isAwaiting && canAccept
  /** 강판 지나감은 OK 를 안 받는다 */
  const acceptsConfirm = isCounting && wait?.hooksAtEntry !== true

  const isUnlockedRef = useRef(false)
  /** 공용 창 아래에서 내려간 대기와 그 0xd 첫 그림의 장면 틱 — 창이 닫혀 다시 받으면 여기서 잇는다 */
  const suspendedRef = useRef<{ readonly wait: SceneConfirmWait; readonly confirmed: number; readonly startTick: number } | null>(null)
  const [sceneDEntryMark, setSceneDEntryMark] = useState(0)
  const [enteredKey, setEnteredKey] = useState<{ readonly wait: SceneConfirmWait; readonly confirmed: number } | null>(null)
  const isInConfirmState =
    isAwaiting && enteredKey !== null && enteredKey.wait === wait && enteredKey.confirmed === confirmed
  // 대기 한 번(객체 · 받은 OK 수)마다 0xd 두 그림 → 0xe → 잠금 세 그림을 새로 센다 — 같은 걸음의 두 번째 0xe 도
  // 0x16 → 0xd 를 지나 다시 센다
  useEffect(() => {
    isUnlockedRef.current = false
    if (!isCounting || wait == null) return
    // 0xd 첫 그림 — 메시지 0xbc1(0x522d2)의 타석 등장음. 대기 하나에 한 번(첫 0xe 몫이라 OK 를 받기 전에만).
    // 등장음이 실린 대기 = 교체 연출 0x16 을 안 거친 0xd 진입이라, 같은 진입 0x48d50 이 48ef8 `[장면+0x28] != 0x16` 일 때
    // 48f02 에서 앱 전역 파티클 관리자를 비운다(0x6dee4, 굴림 없음) — 메뉴에서 남은 이미터도 여기서 진다
    if (confirmed === 0 && wait.atBatEntrySoundId !== undefined && !announcedWaits.has(wait)) {
      announcedWaits.add(wait)
      clearSceneParticles()
      activeSound().play(wait.atBatEntrySoundId)
    }
    // 0xd 첫 그림 — 0x48d50 이 48ee4 에서 투수 그림 객체를 상태 0 으로 되돌린다(0x35650 → 0x340c0). 0xb 에서 곧장 선 0xe 는 0xd 가 없다
    if (wait.skipsSceneD !== true && marksSceneDEntered(wait, confirmed)) setSceneDEntryMark((mark) => mark + 1)
    // 공용 창이 서 있는 채로 내려갔던 같은 대기면 그때 센 장면 틱에서 잇는다 — 장면 시계는 창 아래에서 안 흐른다.
    // 0xd 첫 그림은 받기 시작한 틀의 장면 틱이고, 0xe · 잠금 풀림은 그 틱에서 센 틱 머리에 선다(`setGameSceneTickTimeout`)
    const suspended = suspendedRef.current
    suspendedRef.current = null
    const startTick =
      suspended !== null && suspended.wait === wait && suspended.confirmed === confirmed ? suspended.startTick : gameSceneTickNow()
    const elapsed = gameSceneTickNow() - startTick
    const enteredDelay = SCENE_PREPARE_FRAMES - elapsed
    const unlockedDelay = SCENE_CONFIRM_READY_FRAMES - elapsed
    const entered = enteredDelay <= 0 ? null : setGameSceneTickTimeout(() => setEnteredKey({ wait, confirmed }), enteredDelay)
    if (enteredDelay <= 0) setEnteredKey((key) => (key?.wait === wait && key.confirmed === confirmed ? key : { wait, confirmed }))
    // 강판 지나감 — 0xe 를 한 그림 그린 뒤 끝난다(OK 잠금은 안 푼다). 끝나면 강판 창 0x23 이 선다
    const unlocked = wait.hooksAtEntry === true
      ? setGameSceneTickTimeout(() => {
          passedHookWaits.add(wait)
          setVersion((version) => version + 1)
          for (const listener of confirmListeners) listener()
        }, Math.max(0, SCENE_PREPARE_FRAMES + HOOK_PASSAGE_CONFIRM_FRAMES - elapsed))
      : setGameSceneTickTimeout(() => {
          isUnlockedRef.current = true
        }, Math.max(0, unlockedDelay))
    return () => {
      clearGameSceneTimeout(entered)
      clearGameSceneTimeout(unlocked)
      // 창이 덮어 내려가는 것이면 센 자리를 남긴다 — 다른 덮개(결과 띠 · 교대 판 따위)면 다음에 처음부터 센다
      if (isGameSceneFrozen()) suspendedRef.current = { wait, confirmed, startTick }
    }
  }, [isCounting, wait, confirmed])

  const stateRef = useRef({ wait, confirmed, acceptsConfirm, onConfirm })
  stateRef.current = { wait, confirmed, acceptsConfirm, onConfirm }
  const confirm = useCallback(() => {
    const current = stateRef.current
    if (!current.acceptsConfirm || current.wait == null || !isUnlockedRef.current) return
    // 창이 서 있으면 키 처리 0x498d4 가 없다(52cc6) — 키는 창이 가져간다
    if (isGameSceneFrozen()) return
    // 메시지 1 → 0x50c18 → 0xf 예약 (같은 걸음에 0xe 가 더 남았으면 그 대기로)
    confirmedCounts.set(current.wait, current.confirmed + 1)
    isUnlockedRef.current = false
    setVersion((version) => version + 1)
    for (const listener of confirmListeners) listener()
    current.onConfirm?.()
  }, [])

  useEffect(() => {
    if (!acceptsConfirm) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || !CONFIRM_KEYS.has(event.key)) return
      event.preventDefault()
      confirm()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [acceptsConfirm, confirm])

  return { isAwaiting, isInConfirmState, acceptsConfirm, confirm, sceneDEntryMark }
}
