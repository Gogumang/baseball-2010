import { isInfiniteGamePointOn } from '@/shared/lib/dev/devOptions'
import { GAME_POINT_LIMIT } from '@/entities/season-mode/model/seasonRewards'
import { useCallback, useRef } from 'react'
import { GAME_POINT_USAGE } from '@/entities/collection/model/annalsStats'
import { type SeasonSceneState, SEASON_SCENE_STATE, SEASON_PHASE } from '@/entities/season-mode/model/seasonStateMachine'
import { YEAR_GOAL_EVENT_ID, cursorAfterCalling } from '@/entities/season-mode/model/seasonEventFlow'
import { activeSound } from '@/shared/api/audio/soundPort'
import { SEASON_EVENT_BGM } from '@/app/model/seasonSession/constants/seasonConstants'
import type { SeasonGlobalSlots } from '@/app/model/seasonSession/save/globals'
import type { SeasonSave, SettledSeasonGame } from '@/app/model/seasonSession/save/seasonSave'
import type { SeasonUiStateContext } from '@/app/model/seasonSession/state/useSeasonUiState'

/** `useSeasonSession` 몸통 문장 55~66 을 그대로 옮겼다 (r346) — 부르는 차례 · 훅 차례는 `useSeasonSession` 그대로 */
export function useSeasonPersistence(ctx: SeasonUiStateContext) {
  const { wallet, ownGamePoints, setOwnGamePoints, recordStat, save, setSave, store, globalsRef, carriedGlobals, setGlobals, eventCursor } = ctx
  const { playbackSerial, setEventPlayback, setScene } = ctx
  /**
   * 지금 들고 있는 G — **화면도 판정도 이 값 하나만 본다.**
   *
   * 지갑을 넘기면 `?무한G` 는 지갑 안에서 처리된다(`balance` 가 늘 99999 이고 쓰기는 안 먹는다).
   * 안 넘겼을 때만 예전처럼 여기서 보여 주는 값을 올린다 — 판정도 같은 값을 보므로
   * "99999 인데 G포인트 부족" 같은 어긋남은 어느 쪽에서도 나지 않는다.
   */
  const gamePoints = wallet === null ? (isInfiniteGamePointOn() ? GAME_POINT_LIMIT : ownGamePoints) : wallet.balance
  /** G 보상을 쌓는다 (상한 99999 — 0xa3e4) */
  const gainGamePoint = useCallback(
    (amount: number) => {
      if (wallet !== null) return wallet.gain(amount)
      setOwnGamePoints((points) => Math.min(GAME_POINT_LIMIT, points + amount))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [wallet],
  )
  /**
   * G 를 치른다 (`spendGamePoint` 액션이자 안에서도 쓴다).
   * ⚠️ 지갑을 쓰면 **모자랄 때 한 푼도 안 깎인다**(0xa46e) — 세션 주머니 때의 0 으로 자르기와
   *    다르지만, 화면이 값을 먼저 막으니 닿지 않는 갈래다.
   */
  const spendGamePoint = useCallback(
    (cost: number) => {
      // 시즌이 G 를 쓰는 자리 셋 — 트레이드 0xd152 · 지옥훈련 0xa2fee(500) · 자동진행 0x3c862(모드 2 → k 3, |값|) —
      // 모두 G 를 뺀 뒤 `0x22c29(mgr, 3, 액수)` 로 시즌 소모 GP 에 적는다. 시즌 GP 아이템(0x8058)·십전대보탕(0x7cd8)도 여기로 온다
      recordStat?.({ kind: 'G사용', usage: GAME_POINT_USAGE.season, amount: Math.abs(cost) })
      if (wallet !== null) return wallet.spend(cost)
      setOwnGamePoints((points) => Math.max(0, points - cost))
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [recordStat, wallet],
  )
  /** 정산 진입(0x4ea0c)에서 정산을 마친 경기 — 결과 화면 확인(`finishGame`)이 다음 장면으로 넘긴다 */
  const settledGame = useRef<SettledSeasonGame | null>(null)
  /** 마지막으로 쓴 저장 — 경기 화면의 이어하기 저장(effect)이 렌더 사이에 잇달아 와도 앞 것을 덮지 않게 */
  const latestSave = useRef(save)
  latestSave.current = save
  /**
   * **마지막으로 파일(저장소)에 쓴 시즌** — 원본은 저장 객체(메모리)를 고치는 것과 시즌 파일 쓰기(0x22754)가 따로다. 웹 시즌 저장소
   * 한 칸에 전역 칸 몇(`SeasonGlobalSlots` 등)이 같이 실려 있어, 전역 칸만 쓸 때는 메모리 시즌이 아니라 이 값 위에 얹어 쓴다 —
   * 메모리에만 고친 것(`stageSave`)이 전역 저장 때문에 파일에 새지 않게
   */
  const persistedSave = useRef(save)
  const commit = useCallback(
    (next: SeasonSave) => {
      latestSave.current = next
      persistedSave.current = next
      setSave(next)
      store.save({ ...next, ...globalsRef.current })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [store],
  )
  /** 저장 객체(메모리)만 고친다 — 파일 쓰기는 다음 `commit` 이 한다 (원본의 저장 객체 고치기와 0x22754 사이) */
  const stageSave = useCallback((next: SeasonSave) => {
    latestSave.current = next
    setSave(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  }, [])
  /**
   * 시즌 저장소에 같이 실린 전역 칸 하나를 고치고 곧바로 쓴다 — 메모리 시즌에도 얹되 파일에는 마지막으로 쓴 시즌 위에만 얹는다
   * (`persistedSave`)
   */
  const writeGlobalField = useCallback(
    (patch: Partial<SeasonSave>) => {
      const current = latestSave.current
      const persisted = persistedSave.current
      if (current !== null) stageSave({ ...current, ...patch })
      if (persisted !== null) persistedSave.current = { ...persisted, ...patch }
      store.save({ ...(persisted ?? carriedGlobals.current), ...patch, ...globalsRef.current })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [stageSave, store],
  )
  /** 전역기록 칸(`SeasonGlobalSlots`)을 고치고 곧바로 저장한다 — 원본도 쓰는 그 자리에서 전역 저장 0x1f1b9 를 부른다 */
  const updateGlobals = useCallback(
    (change: (current: SeasonGlobalSlots) => SeasonGlobalSlots) => {
      const next = change(globalsRef.current)
      if (next === globalsRef.current) return
      globalsRef.current = next
      setGlobals(next)
      // 메모리에만 고친 시즌(`stageSave`)은 싣지 않는다 — 전역 저장 0x1f1b9 는 시즌 파일을 안 쓴다
      store.save({ ...(persistedSave.current ?? carriedGlobals.current), ...next })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [store],
  )
  /**
   * 번호로 이벤트를 틀고 0xd3 으로 — `0x8bdc8` 은 커서 +0x2c 를 그 레코드 다음으로 옮긴다(0xae170).
   * 연초 목표 내장 이벤트(0x8a680)는 커서를 건드리지 않는다.
   */
  const startEvent = useCallback((eventId: number, returnScene: SeasonSceneState) => {
    if (eventId !== YEAR_GOAL_EVENT_ID) eventCursor.current = cursorAfterCalling(eventCursor.current, eventId)
    playbackSerial.current += 1
    setEventPlayback({ eventId, returnScene, serial: playbackSerial.current })
    setScene(SEASON_SCENE_STATE.이벤트재생)
    // 0xd3 진입 0x5110 — 0x8be21(이벤트 시작) 뒤 SR+0x50(phase) ≠ 2(정규시즌 경기 끝)이고 내장 이벤트([관리자+0x39f],
    // 연초 목표 0xc038 → 0x8a680)가 아니면 배경음 40 (512c~5152, 나리 114 0x11d00 과 같은 두 가드)
    const phase = latestSave.current?.state.record.phase
    if (eventId !== YEAR_GOAL_EVENT_ID && phase !== SEASON_PHASE.경기끝) activeSound().playBgm(SEASON_EVENT_BGM)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  }, [])
  return {
    gamePoints,
    gainGamePoint,
    spendGamePoint,
    settledGame,
    latestSave,
    persistedSave,
    commit,
    stageSave,
    writeGlobalField,
    updateGlobals,
    startEvent,
  }
}

/** `useSeasonPersistence` 까지 선 값 */
export type SeasonPersistenceContext = SeasonUiStateContext & ReturnType<typeof useSeasonPersistence>
