import { useCallback, useEffect, useRef, useState } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'

/**
 * 상태 0xe 에 들어선 뒤 OK 를 안 받는 갱신 수 — 키 처리 0x498d4 끝(0x49a26~0x49a30)이
 * `[장면+0x1c] == 0xe && [장면+0x2c](이 상태의 틱) ≤ 2` 이면 사람 조작 객체에 키를 넘기지 않는다.
 * 진입 틱을 0 으로 세어 틱 0·1·2 셋을 거른다 (홈런더비 `CONFIRM_LOCK_FRAMES` 와 같은 값·같은 근거).
 */
export const SCENE_CONFIRM_LOCK_FRAMES = 3

/** 0xe 의 OK — 원본 키 −5(OK)·'5'(0x35) (0x532b0). 웹은 Enter·스페이스도 OK 로 받는다 (타석 화면 스윙 키와 같은 묶음) */
const CONFIRM_KEYS: ReadonlySet<string> = new Set(['Enter', ' ', '5'])

/** 대기 객체마다 받은 OK 수 — 화면이 다시 서도 남는다 (진행 상태가 같은 객체를 들고 있는 동안) */
const confirmedCounts = new WeakMap<SceneConfirmWait, number>()

export interface SceneConfirm {
  /** 상태 0xe — 사람 OK 를 기다리는 중 (메뉴가 떠 있어도 참이다) */
  readonly isAwaiting: boolean
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
 * - 받기 시작한 뒤 `SCENE_CONFIRM_LOCK_FRAMES` 갱신 안의 OK 는 무시한다 (0x49a26).
 *   ⚠️ 근사: 원본 틱(+0x2c)은 0xe 에 들어선 때부터 센다. 웹은 화면이 받기 시작한 때(덮개가 걷힌 때)부터 세고,
 *   메뉴를 열었다 닫으면 처음부터 다시 센다 — 일시정지 팝업 동안 장면 틱이 도는지는 안 봤다.
 * - Enter·스페이스·'5' 를 OK 로 받는다. 화면 누르기는 부르는 쪽이 `confirm` 을 잇는다.
 */
export function useSceneConfirm(wait: SceneConfirmWait | null | undefined, canAccept: boolean): SceneConfirm {
  const [, setVersion] = useState(0)
  const confirmed = wait == null ? 0 : (confirmedCounts.get(wait) ?? 0)
  const isAwaiting = wait != null && confirmed < wait.entries
  const acceptsConfirm = isAwaiting && canAccept

  const isUnlockedRef = useRef(false)
  // 대기 한 번(객체 · 받은 OK 수)마다 잠금을 새로 건다 — 같은 걸음의 두 번째 0xe 도 틱 0 부터다
  useEffect(() => {
    isUnlockedRef.current = false
    if (!acceptsConfirm) return
    const timer = window.setTimeout(() => {
      isUnlockedRef.current = true
    }, SCENE_CONFIRM_LOCK_FRAMES * millisecondsPerFrame())
    return () => window.clearTimeout(timer)
  }, [acceptsConfirm, wait, confirmed])

  const stateRef = useRef({ wait, confirmed, acceptsConfirm })
  stateRef.current = { wait, confirmed, acceptsConfirm }
  const confirm = useCallback(() => {
    const current = stateRef.current
    if (!current.acceptsConfirm || current.wait == null || !isUnlockedRef.current) return
    // 메시지 1 → 0x50c18 → 0xf 예약 (같은 걸음에 0xe 가 더 남았으면 그 대기로)
    confirmedCounts.set(current.wait, current.confirmed + 1)
    isUnlockedRef.current = false
    setVersion((version) => version + 1)
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

  return { isAwaiting, acceptsConfirm, confirm }
}
