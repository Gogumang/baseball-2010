import { trackWeakCollectionForSnapshot } from '@/shared/lib/dev/snapshotSlots'
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { activeSound } from '@/shared/api/audio/soundPort'
import { clearSceneParticles } from '@/entities/particle/model/sceneParticleManager'
import { clearGameSceneTimeout, gameSceneTickNow, isGameSceneFrozen, setGameSceneTickTimeout } from '@/shared/lib/commonWindow/commonWindow'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'
import { SCENE_STATE, lastSceneStateEntry, markSceneStateEntries } from '@/shared/lib/commonWindow/sceneStateEntries'
import { pushSceneKey } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'

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
function sceneDEntryTickOf(wait: SceneConfirmWait, confirmed: number, now: number): number {
  const noted = notedSceneDEntries.get(wait)
  if (noted !== undefined && noted.confirmed === confirmed) return noted.tick
  const predicted = lastSceneStateEntry()
  if (predicted !== null && predicted.state === SCENE_STATE.준비 && predicted.tick > now) return predicted.tick
  return now
}

/** 대기 객체마다 받은 OK 수 — 화면이 다시 서도 남는다 (진행 상태가 같은 객체를 들고 있는 동안) */
const confirmedCounts = new WeakMap<SceneConfirmWait, number>()
// 경기 중간 스냅샷(개발 · e2e 전용 — `shared/lib/dev/snapshotSlots`, 배포 빌드에서 빠진다): 상태 객체를 열쇠로 든 약한 표
if (import.meta.env.DEV || import.meta.env.MODE === 'e2e') {
  trackWeakCollectionForSnapshot('useSceneConfirm.announcedWaits', announcedWaits)
  trackWeakCollectionForSnapshot('useSceneConfirm.enteredSceneD', enteredSceneD)
  trackWeakCollectionForSnapshot('useSceneConfirm.passedHookWaits', passedHookWaits)
  trackWeakCollectionForSnapshot('useSceneConfirm.notedSceneDEntries', notedSceneDEntries)
  trackWeakCollectionForSnapshot('useSceneConfirm.confirmedCounts', confirmedCounts)
}

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
  return useSyncExternalStore(
    subscribeConfirm,
    () => isSceneConfirmAwaiting(wait),
    () => isSceneConfirmAwaiting(wait),
  )
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
 * - 0xd 틱 0(`sceneDEntryTickOf` — 교체 연출 끝이 적은 틱, 타석 장면이 미리 적은 아직 오지 않은 0xd, 아니면 덮개가 걷힌 틱)부터
 *   0xd 두 그림(`SCENE_PREPARE_FRAMES`) 뒤 0xe 로 보고, 그 뒤 `SCENE_CONFIRM_LOCK_FRAMES` 갱신 안의 OK 는 무시한다 (0x49a26).
 *   0xd 진입의 일(타석 등장음 · 파티클 비우기 · 투수 그림 상태 0)도 그 틱에 한다.
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
  const isInConfirmState = isAwaiting && enteredKey !== null && enteredKey.wait === wait && enteredKey.confirmed === confirmed
  // 대기 한 번(객체 · 받은 OK 수)마다 0xd 두 그림 → 0xe → 잠금 세 그림을 새로 센다 — 같은 걸음의 두 번째 0xe 도
  // 0x16 → 0xd 를 지나 다시 센다
  useEffect(() => {
    isUnlockedRef.current = false
    if (!isCounting || wait == null) return
    const now = gameSceneTickNow()
    // 공용 창이 서 있는 채로 내려갔던 같은 대기면 그때 센 장면 틱에서 잇는다 — 장면 시계는 창 아래에서 안 흐른다. 아직 오지 않은 0xd 를
    // 잡아 둔 채 내려간 대기(같은 틀에 다시 서는 StrictMode 따위)도 그 틱을 잇는다. 아니면 0xd 진입 틱을 정한다(`sceneDEntryTickOf`).
    // 0xe · 잠금 풀림은 그 틱에서 센 틱 머리에 선다(`setGameSceneTickTimeout`)
    const suspended = suspendedRef.current
    suspendedRef.current = null
    const startTick =
      suspended !== null && suspended.wait === wait && suspended.confirmed === confirmed
        ? suspended.startTick
        : sceneDEntryTickOf(wait, confirmed, now)
    const elapsed = now - startTick
    /** 0xd 첫 그림(진입 0x48d50)의 일 — 0xd 틱 0 이 아직 오지 않았으면 그 틀 머리에 한다 */
    const enterSceneD = () => {
      // 메시지 0xbc1(0x522d2)의 타석 등장음. 대기 하나에 한 번(첫 0xe 몫이라 OK 를 받기 전에만).
      // 등장음이 실린 대기 = 교체 연출 0x16 을 안 거친 0xd 진입이라, 같은 진입 0x48d50 이 48ef8 `[장면+0x28] != 0x16` 일 때
      // 48f02 에서 앱 전역 파티클 관리자를 비운다(0x6dee4, 굴림 없음) — 메뉴에서 남은 이미터도 여기서 진다
      if (confirmed === 0 && wait.atBatEntrySoundId !== undefined && !announcedWaits.has(wait)) {
        announcedWaits.add(wait)
        clearSceneParticles()
        activeSound().play(wait.atBatEntrySoundId)
      }
      // 0x48d50 이 48ee4 에서 투수 그림 객체를 상태 0 으로 되돌린다(0x35650 → 0x340c0). 0xb 에서 곧장 선 0xe 는 0xd 가 없다
      if (wait.skipsSceneD !== true && marksSceneDEntered(wait, confirmed)) setSceneDEntryMark((mark) => mark + 1)
    }
    const sceneDEntered = elapsed < 0 ? setGameSceneTickTimeout(enterSceneD, -elapsed) : null
    if (elapsed >= 0) enterSceneD()
    // 상태 경계(`sceneStateEntries`) — 0xd 첫 그림이 0xd 틱 0, 0x39e14 가 틱 1 에 0xe 를 예약해 두 그림 뒤가 0xe 틱 0. 교체 창 0xb 에서
    // 곧장 선 0xe(`skipsSceneD`)는 0xd 가 없다(웹은 그때도 두 그림을 센다 — 0xe 칸만 그 자리에 적는다)
    markSceneStateEntries(...(wait.skipsSceneD === true ? [] : [{ tick: startTick, state: SCENE_STATE.준비 }]), {
      tick: startTick + SCENE_PREPARE_FRAMES,
      state: SCENE_STATE.확인,
    })
    const enteredDelay = SCENE_PREPARE_FRAMES - elapsed
    const unlockedDelay = SCENE_CONFIRM_READY_FRAMES - elapsed
    const entered = enteredDelay <= 0 ? null : setGameSceneTickTimeout(() => setEnteredKey({ wait, confirmed }), enteredDelay)
    if (enteredDelay <= 0) setEnteredKey((key) => (key?.wait === wait && key.confirmed === confirmed ? key : { wait, confirmed }))
    // 강판 지나감 — 0xe 를 한 그림 그린 뒤 끝난다(OK 잠금은 안 푼다). 끝나면 강판 창 0x23 이 선다
    const unlocked =
      wait.hooksAtEntry === true
        ? setGameSceneTickTimeout(
            () => {
              passedHookWaits.add(wait)
              setVersion((version) => version + 1)
              for (const listener of confirmListeners) listener()
            },
            Math.max(0, SCENE_PREPARE_FRAMES + HOOK_PASSAGE_CONFIRM_FRAMES - elapsed),
          )
        : setGameSceneTickTimeout(
            () => {
              isUnlockedRef.current = true
            },
            Math.max(0, unlockedDelay),
          )
    return () => {
      clearGameSceneTimeout(sceneDEntered)
      clearGameSceneTimeout(entered)
      clearGameSceneTimeout(unlocked)
      // 창이 덮어 내려가는 것이면 센 자리를 남긴다 — 다른 덮개(결과 띠 · 교대 판 따위)면 다음에 처음부터 센다.
      // 0xd 가 아직 안 섰으면(정해 둔 진입 틱이 앞날) 그 틱도 남긴다 — 다시 서면 같은 0xd 를 기다린다
      if (isGameSceneFrozen() || startTick > gameSceneTickNow()) suspendedRef.current = { wait, confirmed, startTick }
    }
  }, [isCounting, wait, confirmed])

  const stateRef = useRef({ wait, confirmed, acceptsConfirm, onConfirm })
  stateRef.current = { wait, confirmed, acceptsConfirm, onConfirm }
  const confirmNow = useCallback(() => {
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
  /**
   * OK 는 받은 그 자리에서 처리하지 않고 장면 키 칸에 넣는다 — 0xe 의 OK 는 다음 틀의 키 0x498d4 → 0x532b0 이 읽어 메시지 1 로
   * 0xf 를 예약하고(그 다음 틀이 0xf 틱 0), 타석(`BattingStage`)이 서 있으면 그 틀에서 꺼낸다(`pushSceneKey` — 없으면 바로)
   */
  const confirm = useCallback(() => {
    if (!stateRef.current.acceptsConfirm || isGameSceneFrozen()) return
    pushSceneKey(confirmNow)
  }, [confirmNow])

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
