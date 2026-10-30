import { useCallback, useEffect, useRef, useState } from 'react'
import { clearGameSceneTimeout, gameSceneTickNow, isGameSceneFrozen, setGameSceneTickTimeout } from '@/shared/lib/commonWindow/commonWindow'
import type { SceneConfirmWait } from '@/features/play-game/model/sceneConfirm'
import { SCENE_STATE, markSceneStateEntries, type SceneStateEntry } from '@/shared/lib/commonWindow/sceneStateEntries'
import { pushSceneKey } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import { SCENE_CONFIRM_READY_FRAMES, SCENE_PREPARE_FRAMES } from '@/features/play-game/model/useSceneConfirm/sceneConfirmFrames'
import {
  confirmedCountOf,
  confirmedCounts,
  isSceneConfirmAwaiting,
  notifyConfirmListeners,
  sceneDEntryTickOf,
} from '@/features/play-game/model/useSceneConfirm/sceneConfirmStore'
import { enterSceneDOf, scheduleHookPassage, scheduleSceneDEntry } from '@/features/play-game/model/useSceneConfirm/sceneDEntry'

/** 0xe 의 OK — 원본 키 −5(OK)·'5'(0x35) (0x532b0). 웹은 Enter·스페이스도 OK 로 받는다 (타석 화면 스윙 키와 같은 묶음) */
const CONFIRM_KEYS: ReadonlySet<string> = new Set(['Enter', ' ', '5'])

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

interface WaitKey {
  readonly wait: SceneConfirmWait
  readonly confirmed: number
}

/** 같은 대기 한 번(객체 · 받은 OK 수)인가 */
function isSameWaitKey(key: WaitKey | null, wait: SceneConfirmWait | null | undefined, confirmed: number): boolean {
  return key !== null && key.wait === wait && key.confirmed === confirmed
}

/**
 * 상태 경계(`sceneStateEntries`) — 0xd 첫 그림이 0xd 틱 0, 0x39e14 가 틱 1 에 0xe 를 예약해 두 그림 뒤가 0xe 틱 0. 교체 창 0xb 에서
 * 곧장 선 0xe(`skipsSceneD`)는 0xd 가 없다(웹은 그때도 두 그림을 센다 — 0xe 칸만 그 자리에 적는다)
 */
function confirmStateEntriesOf(wait: SceneConfirmWait, startTick: number): SceneStateEntry[] {
  const confirmEntry = { tick: startTick + SCENE_PREPARE_FRAMES, state: SCENE_STATE.확인 }
  return wait.skipsSceneD === true ? [confirmEntry] : [{ tick: startTick, state: SCENE_STATE.준비 }, confirmEntry]
}

/** 0xe 에 들어서는 틀 — 아직이면 그 틀 머리에 `enter`, 이미 지났으면 곧바로 `keepOrEnter` */
function scheduleConfirmStateEntry(delay: number, enter: () => void, keepOrEnter: () => void): number | null {
  if (delay > 0) return setGameSceneTickTimeout(enter, delay)
  keepOrEnter()
  return null
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
  const confirmed = confirmedCountOf(wait)
  const isAwaiting = isSceneConfirmAwaiting(wait)
  /** 0xd · 0xe 를 세는 중 — 강판 지나감(`hooksAtEntry`)도 센다 */
  const isCounting = isAwaiting && canAccept
  /** 강판 지나감은 OK 를 안 받는다 */
  const acceptsConfirm = isCounting && wait?.hooksAtEntry !== true

  const isUnlockedRef = useRef(false)
  /** 공용 창 아래에서 내려간 대기와 그 0xd 첫 그림의 장면 틱 — 창이 닫혀 다시 받으면 여기서 잇는다 */
  const suspendedRef = useRef<(WaitKey & { readonly startTick: number }) | null>(null)
  const [sceneDEntryMark, setSceneDEntryMark] = useState(0)
  const [enteredKey, setEnteredKey] = useState<WaitKey | null>(null)
  const isInConfirmState = isAwaiting && isSameWaitKey(enteredKey, wait, confirmed)
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
    const startTick = (isSameWaitKey(suspended, wait, confirmed) ? suspended?.startTick : undefined) ?? sceneDEntryTickOf(wait, confirmed, now)
    const elapsed = now - startTick
    const bumpMark = () => setSceneDEntryMark((mark) => mark + 1)
    const sceneDEntered = scheduleSceneDEntry(elapsed, () => enterSceneDOf(wait, confirmed, bumpMark))
    markSceneStateEntries(...confirmStateEntriesOf(wait, startTick))
    const unlockedDelay = SCENE_CONFIRM_READY_FRAMES - elapsed
    const entered = scheduleConfirmStateEntry(
      SCENE_PREPARE_FRAMES - elapsed,
      () => setEnteredKey({ wait, confirmed }),
      () => setEnteredKey((key) => (isSameWaitKey(key, wait, confirmed) ? key : { wait, confirmed })),
    )
    // 강판 지나감 — 0xe 를 한 그림 그린 뒤 끝난다(OK 잠금은 안 푼다). 끝나면 강판 창 0x23 이 선다
    const unlocked =
      wait.hooksAtEntry === true
        ? scheduleHookPassage(wait, elapsed, () => setVersion((version) => version + 1))
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
  useMirrorRef(stateRef, { wait, confirmed, acceptsConfirm, onConfirm })
  const confirmNow = useCallback(() => {
    const current = stateRef.current
    if (!current.acceptsConfirm || current.wait == null || !isUnlockedRef.current) return
    // 창이 서 있으면 키 처리 0x498d4 가 없다(52cc6) — 키는 창이 가져간다
    if (isGameSceneFrozen()) return
    // 메시지 1 → 0x50c18 → 0xf 예약 (같은 걸음에 0xe 가 더 남았으면 그 대기로)
    confirmedCounts.set(current.wait, current.confirmed + 1)
    isUnlockedRef.current = false
    setVersion((version) => version + 1)
    notifyConfirmListeners()
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
