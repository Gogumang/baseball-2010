import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
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
  return wait != null && (confirmedCounts.get(wait) ?? 0) < wait.entries
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
}

/**
 * **상태 0xe 의 OK 대기** — 진행기가 실어 둔 대기 객체(`SceneConfirmWait`)를 보고 OK 를 센다.
 *
 * - `canAccept` 가 거짓이면(경기 중 메뉴·조작방법·설정·교대 판·인트로가 덮고 있으면) 키를 안 받는다 — 일시정지 팝업
 *   0x754f9 가 떠 있으면 경기 키가 안 가고, 0x498d4 의 OK 는 0xe 의 사람 조작 객체에게만 간다.
 * - 받기 시작하면 0xd 두 그림(`SCENE_PREPARE_FRAMES`) 뒤 0xe 로 보고, 그 뒤 `SCENE_CONFIRM_LOCK_FRAMES` 갱신 안의 OK 는
 *   무시한다 (0x49a26). ⚠️ 근사: 원본은 0xd 에 들어선 때부터 센다. 웹은 화면이 받기 시작한 때(덮개가 걷힌 때)부터 세고,
 *   메뉴를 열었다 닫으면 처음부터 다시 센다 — 일시정지 팝업 동안 장면 틱이 도는지는 안 봤다.
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
  const isAwaiting = wait != null && confirmed < wait.entries
  const acceptsConfirm = isAwaiting && canAccept

  const isUnlockedRef = useRef(false)
  const [enteredKey, setEnteredKey] = useState<{ readonly wait: SceneConfirmWait; readonly confirmed: number } | null>(null)
  const isInConfirmState =
    isAwaiting && enteredKey !== null && enteredKey.wait === wait && enteredKey.confirmed === confirmed
  // 대기 한 번(객체 · 받은 OK 수)마다 0xd 두 그림 → 0xe → 잠금 세 그림을 새로 센다 — 같은 걸음의 두 번째 0xe 도
  // 0x16 → 0xd 를 지나 다시 센다
  useEffect(() => {
    isUnlockedRef.current = false
    if (!acceptsConfirm || wait == null) return
    const frame = millisecondsPerFrame()
    const entered = window.setTimeout(() => setEnteredKey({ wait, confirmed }), SCENE_PREPARE_FRAMES * frame)
    const unlocked = window.setTimeout(() => {
      isUnlockedRef.current = true
    }, SCENE_CONFIRM_READY_FRAMES * frame)
    return () => {
      window.clearTimeout(entered)
      window.clearTimeout(unlocked)
    }
  }, [acceptsConfirm, wait, confirmed])

  const stateRef = useRef({ wait, confirmed, acceptsConfirm, onConfirm })
  stateRef.current = { wait, confirmed, acceptsConfirm, onConfirm }
  const confirm = useCallback(() => {
    const current = stateRef.current
    if (!current.acceptsConfirm || current.wait == null || !isUnlockedRef.current) return
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

  return { isAwaiting, isInConfirmState, acceptsConfirm, confirm }
}
