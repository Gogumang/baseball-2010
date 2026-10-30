import { useSyncExternalStore } from 'react'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'
import { SCENE_STATE, lastSceneStateEntry } from '@/shared/lib/commonWindow/sceneStateEntries'

/**
 * **대기 객체마다 남는 칸** — 화면(`useSceneConfirm`)이 다시 서도(메뉴를 열었다 닫아도) 남아야 하는 셈들. 대기 객체를 열쇠로 한 약한 표다.
 */

/** 타석 등장음을 이미 낸 대기 — 화면이 다시 서도(메뉴를 열었다 닫아도) 두 번 안 낸다 */
export const announcedWaits = new WeakSet<SceneConfirmWait>()

/**
 * 0xd 첫 그림을 이미 센 (대기, 받은 OK 수) — 같은 0xd 를 화면이 다시 서도(메뉴를 열었다 닫아도) 두 번 세지 않는다
 */
const enteredSceneD = new WeakMap<SceneConfirmWait, Set<number>>()

/** (대기, 받은 OK 수)의 0xd 를 처음 본다면 적고 참 */
export function marksSceneDEntered(wait: SceneConfirmWait, confirmed: number): boolean {
  const seen = enteredSceneD.get(wait) ?? new Set<number>()
  if (seen.has(confirmed)) return false
  seen.add(confirmed)
  enteredSceneD.set(wait, seen)
  return true
}

/** 0xd 두 그림 · 0xe 한 그림을 다 지난 강판 지나감(`hooksAtEntry`) — 화면이 다시 서도 남는다 */
export const passedHookWaits = new WeakSet<SceneConfirmWait>()

/**
 * **0xd 진입 틱을 아는 쪽이 적어 둔 것** — (대기, 받은 OK 수)마다 그 0xd 의 틱 0 인 장면 틱. 교체 연출 0x16 은 끝 비트를 본 그림의
 * 메시지 0xd 로 다음 틀이 0xd 틱 0 이라(`SubstitutionSceneOverlay` 의 `onDone` 이 그 틀 머리에 불린다) 그 틱을 여기에 적고
 * (`noteSceneDEntryTick`), 대기를 세기 시작할 때 화면이 받기 시작한 틱 대신 이것을 쓴다(같은 대기를 다시 세워도 같은 틱).
 */
const notedSceneDEntries = new WeakMap<SceneConfirmWait, { readonly confirmed: number; readonly tick: number }>()

/**
 * (대기, 받은 OK 수 `confirmed`)의 0xd 가 장면 틱 `tick` 에 선다 — 교체 연출 0x16 을 다 그린 쪽(`useSubstitutionScene.finish` ·
 * 미션 `finishSubstitutionScene`)이 부른다
 */
export function noteSceneDEntryTick(wait: SceneConfirmWait | null | undefined, confirmed: number, tick: number): void {
  if (wait == null) return
  notedSceneDEntries.set(wait, { confirmed, tick })
}

/**
 * 대기를 세기 시작하는 0xd 의 틱 0 — 원본은 0xd 를 예약한 다음 틀이 0xd 틱 0 이다(0xbcb48 → 0xbc9c8). 웹 덮개가 걷힌 틱은 덮개마다
 * 그 예약 틀이기도 하고 진입 틀이기도 해서, 0xd 진입 틱을 아는 쪽이 적은 값을 먼저 쓴다:
 * 1. 교체 연출 끝이 적은 틱(`noteSceneDEntryTick`) — 0x16 끝 메시지 0xd 의 다음 틀
 * 2. 타석 장면이 미리 적은 상태 경계(`sceneStateEntries`)의 **마지막 칸이 아직 오지 않은 0xd** 면 그 틱 — 0x12 문턱 갱신 0x4e6d4 가
 *    판정 A 0xae24c 로 0xd 를 예약한 틀(0x12 틱 문턱)에 결과 띠(`pauseWithBanner`)가 걷히고 0xd 는 그 다음 틀이다
 *    (`BattingStage.showResult` · `pitcherSideStateEntriesOf` 가 0x12 진입 + 문턱 + 1 에 0xd 를 적는다). 지난 0xd 칸은 쓰지 않는다 —
 *    3아웃 뒤 자동진행 중계 0x21 · 이닝 판 0x18 · 수비 판 0x17 을 거친 0xd 는 그 칸이 맞지 않다(타석 장면은 다음 상태를 늘 0xd 로 적는다)
 * 3. 그 밖에는 지금 틱(덮개가 걷힌 틀)
 */
export function sceneDEntryTickOf(wait: SceneConfirmWait, confirmed: number, now: number): number {
  const noted = notedSceneDEntries.get(wait)
  if (noted !== undefined && noted.confirmed === confirmed) return noted.tick
  const predicted = lastSceneStateEntry()
  if (predicted !== null && predicted.state === SCENE_STATE.준비 && predicted.tick > now) return predicted.tick
  return now
}

/** 대기 객체마다 받은 OK 수 — 화면이 다시 서도 남는다 (진행 상태가 같은 객체를 들고 있는 동안) */
export const confirmedCounts = new WeakMap<SceneConfirmWait, number>()

/** OK 를 받을 때마다 부른다 — 대기를 화면 밖에서 보는 쪽(`useIsSceneConfirmAwaiting`)이 다시 그린다 */
export const confirmListeners = new Set<() => void>()
const subscribeConfirm = (listener: () => void) => {
  confirmListeners.add(listener)
  return () => {
    confirmListeners.delete(listener)
  }
}

/** OK 를 받았다 — 대기를 화면 밖에서 보는 쪽이 다시 그린다 */
export function notifyConfirmListeners(): void {
  for (const listener of confirmListeners) listener()
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
  return useSyncExternalStore(
    subscribeConfirm,
    () => isSceneConfirmAwaiting(wait),
    () => isSceneConfirmAwaiting(wait),
  )
}
