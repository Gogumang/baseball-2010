import { createContext, useContext, useLayoutEffect } from 'react'
import { appTickOf, appTickStartTime, resetAppTickClockForTest, setTickInterval } from '@/shared/lib/frameClock/frameClock'

/**
 * **공용 창 [0x140005c] 이 떠 있는가** — 히든 오픈 알림(0x62368 → 0x74ef5)처럼 앱이 모든 화면 위에 얹는 창.
 *
 * 장면 틀마다 0x754f9(창, 키)가 [창+9](떠 있음)이면 참을 돌려주고, 장면이 그때 건너뛰는 것은 장면마다 다르다 (직접 떴다):
 * ```
 * 경기 장면 0x52c50  52cc6 참이면 52ef2 로 — 상태 바꿈 0xbc9c9(틱 [장면+0x2c] +1 · 진입) · 키 0x498d4 · 상태 갱신표 0xd0530 을
 *                    모두 건너뛰고 그리기(0x457cc · 0x41230 · 그리기표 0xd05a0)만 한다
 * 나리 0x1cdec       1d070 참이면 상태 키 표 0xcc7e0 만 건너뛴다 — 상태 바꿈 · 진입(ce0e~) · 갱신(1d1b2~) · 그리기는 돈다
 * 시즌 0xe9ac        ec70 참이면 상태 키 표 0xcbf6c 만 건너뛴다
 * 메인 메뉴 0x32634  3263e 참이면 하위 상태 키 표 0xcefa4 만 건너뛴다 ([메뉴+0xe0] = 그 값)
 * 미션 고르기 0x1ea98 1eaac 참이면 0x1e99c(장면, 상태, 2) 를 건너뛴다 ([장면+0xa2] = 그 값)
 * ```
 * 키는 창(`MessageBox`)이 잡는 단계에서 다 가져가므로 웹은 따로 막을 것이 없고, 경기 장면만 이 값으로 갱신을 멈춘다
 * (`BattingStage` — 정산 0x19 갱신 0x4b100 의 결과 배경 +0x17e2 가라앉음).
 */
export const CommonWindowOpenContext = createContext(false)

export function useIsCommonWindowOpen(): boolean {
  return useContext(CommonWindowOpenContext)
}

/**
 * **공용 창에 글을 띄운다 — 0x74ef5([0x140005c], 글, 종류 1, 0, 0)**. 히든 오픈 알림과 같은 창 · 같은 줄(떠 있는 것 하나 + 대기 하나)이다.
 * 앱이 창을 들고 있지 않은 자리(시험 등)에서는 아무것도 안 한다.
 */
export const CommonWindowPushContext = createContext<(text: string) => void>(() => undefined)

export function useCommonWindowPush(): (text: string) => void {
  return useContext(CommonWindowPushContext)
}

/**
 * **지금 장면이 [창+0x24f] = 1 을 세웠는가** — 장면 생성자만 이 칸을 쓴다(리터럴 0x24f 를 읽는 곳 전수, 2026-10-14 직접 뜸):
 * ```
 * 1 을 쓰는 곳  메인 메뉴 0x234d4(234dc~234e2) · 경기 0x3301c(33062~)
 * 0 을 쓰는 곳  시즌 0x3b14(3b1c~) · 나리 0xf684(f688~) · 미션 목록 0x1d784(1d788~)
 * 읽는 곳       0x74228(0x741a0) · 0x7503c(0x74ef4) — 창을 띄울 때 [창+0x24e] 로 옮긴다 · 0x32dd8 · 0x74458 · 0x52efe(경기 그리기)
 * ```
 * [+0x24e] 가 선 창은 키를 받은 갱신의 격자 · 키 표 갈래가 [+0x215] 와 함께 폭 0 을 적어(75656~7566c · 756a4~756b4)
 * 다음 갱신에 줄임 없이 닫힌다 — `MessageBox` 의 `closesWithoutShrink` 기본값이 이것이다.
 * 앱이 지금 화면으로 값을 정하고, 경기 장면(0x104)을 그리는 화면은 `useMarksGameScene` 으로 서 있는 동안 1 로 둔다.
 */
export const CommonWindowSceneContext = createContext(false)

export function useSceneClosesWithoutShrink(): boolean {
  return useContext(CommonWindowSceneContext)
}

/** 경기 장면이 섰다(true) · 내려갔다(false) — 앱이 센다. 앱이 없는 자리(시험)에서는 아무것도 안 한다 */
export const GameSceneMarkContext = createContext<(isUp: boolean) => void>(() => undefined)

/**
 * 경기 장면 0x104(생성자 0x3301c 가 [창+0x24f] = 1)를 그리는 화면이 부른다 — 서 있는 동안 앱의 공용 창(히든 오픈 알림 따위)과
 * 그 아래 `MessageBox` 가 줄임 없이 닫힌다.
 */
export function useMarksGameScene(): void {
  const mark = useContext(GameSceneMarkContext)
  useLayoutEffect(() => {
    mark(true)
    const release = markGameSceneUp()
    return () => {
      release()
      mark(false)
    }
  }, [mark])
}

/** `useMarksGameScene` 을 갈래 안에서 쓰는 자리(경기 끝 판 0x18 · 정산 0x19 를 한 화면이 같이 그리는 결과 화면 따위) */
export function GameSceneMark(): null {
  useMarksGameScene()
  return null
}

/**
 * **공용 창 [0x140005c] 이 지금 떠 있는가([창+9] ≠ 0)** — 앱 전역 한 칸. `MessageBox`(0x74ef4) · `usePopupWindowMotion`(0x741a0) 창이
 * 서 있는 동안, 그리고 경기 중 메뉴의 [조작방법] · [설정](0x3c212 · 0x3c326 이 같은 일시정지 창을 대기 칸으로 다시 띄워 그 위에
 * 뷰어 · 설정 판을 그린다 — I 4c-3)이 떠 있는 동안 센다.
 *
 * 그리기 루프(requestAnimationFrame)가 React 를 거치지 않고 읽는 값이라 문맥(`CommonWindowOpenContext` — 히든 오픈 알림만)과 따로 둔다.
 * 지금 읽는 곳: 경기 장면 0x52c50 의 파티클 게이트(53048~5304c `ldrb r3, [r6, #9]` · `bne 0x53064` — 떠 있으면 관리자 틱 0x6de85 ·
 * 그리기 0x6dd69 를 **둘 다** 건너뛴다). 다른 장면 프레임(0x32dd8 의 32f48 · 0xe9ac 의 f112 · 0x1cdec 의 1d480 · 0x1eb0c 의 1eb2a)은
 * 이 게이트가 없다 — 창이 떠 있어도 굴리고 그린다(2026-10-16 직접 떴다).
 */
let shownCommonWindows = 0

/** 창 하나가 섰다 — 돌려준 함수로 내린다(두 번 불러도 한 번만 내린다) */
export function markCommonWindowShown(): () => void {
  shownCommonWindows += 1
  syncGameSceneFreeze()
  const generation = testGeneration
  let released = false
  return () => {
    if (released || generation !== testGeneration) return
    released = true
    shownCommonWindows -= 1
    syncGameSceneFreeze()
  }
}

/** [0x140005c]+9 — 공용 창이 하나라도 떠 있는가 */
export function isCommonWindowShown(): boolean {
  return shownCommonWindows > 0
}

/** `isShown` 인 동안 공용 창이 떠 있다고 센다 */
export function useMarksCommonWindowShown(isShown: boolean): void {
  useLayoutEffect(() => (isShown ? markCommonWindowShown() : undefined), [isShown])
}

/**
 * **경기 장면이 멈췄는가 — 경기 장면(0x104)이 서 있고 공용 창 [0x140005c]+9 가 서 있다**. 경기 장면 프레임 0x52c50 은 그때
 * (2026-10-16 직접 떴다):
 * ```
 * 52cc6  0x754f9(창, 키) ≠ 0 → 52ef2 로 — 장면 틱 0xbc9c9([장면+0x2c] +1 · 진입 표 0xd04bc) · 키 0x498d4 · 갱신 표 0xd0530 ·
 *        목록 틱 0x3f060 · 0xaada5 · 0xbfc8d 를 모두 건너뛴다
 * 52ef2  창이 서 있으면 0x457cc(자르기를 화면 전체로)
 * 52efe  [창+0x24f](경기 장면 1) && [창+9] && [창+0x250] == 0 이면 53032 로 — 0x41230 · 그리기 표 0xd05a0 을 건너뛴다
 *        ([+0x250] 은 창을 띄운 0x74ef4 · 0x741a0 이 1, 같은 그림 끝 창 그리기 0x746cc 가 0 — 창이 선 첫 그림만 장면을 다시 그린다)
 * 53048  창이 서 있으면 파티클 관리자 틱 0x6de85 · 그리기 0x6dd69 를 건너뛴다
 * 53086  창이 서 있으면 0x3f378 을 건너뛴다
 * ```
 * 곧 창이 떠 있는 동안 장면은 한 틱도 안 흐르고(틱을 모아 두었다 따라잡지도 않는다) 화면은 창이 선 첫 그림 모습으로 굳는다.
 * 다른 장면 프레임(메인 메뉴 0x32dd8 · 시즌 0xe9ac · 나리 0x1cdec · 미션 고르기 0x1eb0c)은 이 게이트가 없다.
 */
let gameScenesUp = 0
/** 멈추기 시작한 실제 시각(`performance.now()` 기준) — 흐르는 중이면 null */
let frozenSince: number | null = null
/** 지금까지 멈춰 있던 실제 시간의 합 */
let frozenTotal = 0
/** 멈추기 시작한 때의 앱 틱 — 흐르는 중이면 null */
let frozenSinceAppTick: number | null = null
/**
 * 지금까지 멈춰 있던 **앱 틱** 수의 합 — 경기 장면 틱 = 앱 틱 − 이 값 (`gameSceneTickOf`). 원본은 앱 루프 하나가 틀을 돌리고 경기 장면
 * 0x52c50 은 창이 서 있는 틀(52cc6)에 갱신만 건너뛴다 — 틀 머리는 앱 틀 그대로라 장면 틱도 앱 틱 격자 위에 선다.
 */
let frozenTicks = 0
/** `resetCommonWindowShownForTest` 마다 오른다 */
let testGeneration = 0

/** 멈추기 시작할 때마다 오른다 — 창이 선 첫 그림([창+0x250])을 부품마다 한 번 세는 데 쓴다(`createGameSceneDrawGate`) */
let freezeSerial = 0
/** 서 있는 경기 장면 로딩 판(상태 7 · 9 · 8 — `LoadingTip`) 수 (`useMarksGameSceneLoading`) */
let loadingScenesUp = 0
/** 멈추기 시작한 횟수 중 로딩 판(상태 7 · 8 · 9)이 아닐 때 선 것 — 그 첫 그림만 배경 0x41230 을 다시 그린다(52f26~52f36) */
let backdropFreezeSerial = 0

function syncGameSceneFreeze(now: number = performance.now()): void {
  const isFrozen = gameScenesUp > 0 && shownCommonWindows > 0
  if (isFrozen && frozenSince === null) {
    frozenSince = now
    frozenSinceAppTick = appTickOf(now)
    freezeSerial += 1
    if (loadingScenesUp === 0) backdropFreezeSerial += 1
    for (const timer of sceneTimers.values()) pauseSceneTimer(timer, now)
  } else if (!isFrozen && frozenSince !== null) {
    frozenTotal += Math.max(0, now - frozenSince)
    // 창이 선 틀부터 닫힌 틀까지 앱 틱 수 — 닫힌 틀이 든 앱 틱은 멈춘 장면 틱 그대로이고 다음 앱 틱 머리에서 하나 오른다
    frozenTicks += Math.max(0, appTickOf(now) - (frozenSinceAppTick ?? appTickOf(now)))
    frozenSince = null
    frozenSinceAppTick = null
    for (const [id, timer] of sceneTimers) runSceneTimer(id, timer, now)
  }
}

/**
 * **경기 장면 시계로 재는 setTimeout** — 경기 장면의 상태 길이(상태 틱 [장면+0x2c] 를 세는 갱신 · 진입 · 그 그림의 소리)는
 * 공용 창이 서 있는 동안 52cc6 이 장면 틱 0xbc9c9 · 진입 표 0xd04bc · 갱신 표 0xd0530 을 통째로 건너뛰어 서고, 닫히면 그 자리에서
 * 이어 센다(따라잡지 않는다). 웹 시계도 그동안 남은 시간을 붙잡아 두었다가 닫히면 남은 만큼만 더 기다린다.
 * 장면이 멈춰 있지 않으면 `setTimeout` 과 같고, 멈춘 동안 건 시계는 풀린 때부터 잰다. 경기 장면 밖에서는 늘 그냥 흐른다.
 */
interface SceneTimer {
  readonly callback: () => void
  /** 아직 남은 장면 시간(ms) — 틱으로 건 시계(`dueTick`)는 쓰지 않는다 */
  remaining: number
  /** 틱으로 건 시계(`setGameSceneTickTimeout`)가 울릴 장면 틱 — 그 틱 머리(앱 틱 격자)에 울린다. ms 시계면 null */
  readonly dueTick: number | null
  /** 지금 도는 실제 시계를 건 실제 시각 — 붙잡혀 있으면 null */
  startedAt: number | null
  handle: ReturnType<typeof setTimeout> | null
}
const sceneTimers = new Map<number, SceneTimer>()
let nextSceneTimerId = 1

function runSceneTimer(id: number, timer: SceneTimer, now: number): void {
  if (timer.handle !== null) return
  timer.startedAt = now
  // 틱 시계는 남은 ms 가 아니라 울릴 장면 틱의 머리(= 앱 틱 머리)까지 잰다 — 창이 닫힌 뒤에도 틱 머리에 선다
  const delay = timer.dueTick === null ? timer.remaining : Math.max(0, appTickStartTime(timer.dueTick + frozenTicks) - now)
  timer.handle = setTimeout(() => {
    sceneTimers.delete(id)
    timer.handle = null
    timer.callback()
  }, delay)
}

function pauseSceneTimer(timer: SceneTimer, now: number): void {
  if (timer.handle === null) return
  clearTimeout(timer.handle)
  timer.handle = null
  if (timer.dueTick === null) timer.remaining = Math.max(0, timer.remaining - (now - (timer.startedAt ?? now)))
  timer.startedAt = null
}

function addSceneTimer(callback: () => void, remaining: number, dueTick: number | null): number {
  const id = nextSceneTimerId
  nextSceneTimerId += 1
  const timer: SceneTimer = { callback, remaining: Math.max(0, remaining), dueTick, startedAt: null, handle: null }
  sceneTimers.set(id, timer)
  if (frozenSince === null) runSceneTimer(id, timer, performance.now())
  return id
}

/** 경기 장면 시계로 `delay` ms 뒤 `callback` — `clearGameSceneTimeout` 으로 거둔다 */
export function setGameSceneTimeout(callback: () => void, delay: number): number {
  return addSceneTimer(callback, delay, null)
}

/** `setGameSceneTimeout` 으로 건 시계를 거둔다(이미 울렸거나 없는 번호면 아무 일 없다) */
export function clearGameSceneTimeout(id: number | null | undefined): void {
  if (id == null) return
  const timer = sceneTimers.get(id)
  if (timer === undefined) return
  if (timer.handle !== null) clearTimeout(timer.handle)
  sceneTimers.delete(id)
}

/**
 * **창이 선 첫 그림의 그리기 셈** — 52efe 는 [창+0x24f](경기 장면 1) && [창+9] && **[창+0x250] == 0** 일 때만 0x41230 · 그리기 표
 * 0xd05a0 을 건너뛴다. [+0x250] 은 창을 띄운 0x74ef4(7503c~) · 0x741a0 이 1 로 세우고 같은 그림 끝 창 그리기 0x746cc(53078)가 0 으로
 * 지운다 — 곧 창이 선 첫 그림은 갱신(52cc6)이 없어도 장면 그리기가 한 번 더 돈다. 그리기 함수가 스스로 올리는 칸(조준 애니 0 칸 ·
 * 게이지 커서 0x4d708 · 미션 목표 줄 0x36714 따위)은 그 그림에 한 번 오른다.
 *
 * 부품마다 하나 만들어 그림 틀마다 `allowsDraw()` 를 묻는다 — 장면이 흐르면 참, 멈춘 뒤 처음 묻는 한 번만 참, 그 뒤로 거짓.
 * 만든 때 이미 멈춰 있었으면 그 멈춤의 첫 그림은 지난 것으로 본다(멈춘 동안 새 상태가 서는 일은 없다).
 *
 * 대기 칸 창이 이어 설 때도 같다 — 창 갱신 0x754f8 이 75552 · 755d4 에서 0x75440 을 불러 0x74ef4 · 0x741a0 으로 다음 창을 띄우므로
 * [+0x250] 이 다시 선다(웹은 앞 창이 내려가고 같은 때 다음 창이 서서 멈춤이 새로 센다).
 *
 * ⚠️ 근사(때): 원본은 창을 연 자리가 갱신(52cc6) 앞(대기 칸 창이 0x754f9 안에서 서는 때 · 폰 인터럽트 0x463ac)이면 그 그림이 갱신 없이
 * 그리기만 하고, 갱신 뒤(키 0x498d4 의 '*' 메뉴 · 진입 · 갱신의 히든 오픈 알림)면 그 그림은 갱신 · 그리기를 다 한다. 웹은 창이 서는
 * 커밋에서 곧장 멈추고 그리기 셈만 한 번 더 올린다 — 뒤 경우의 갱신 한 틱은 웹에 없다.
 */
/**
 * 경기 장면이 멈추기 시작한 횟수 — 곧 창이 선 첫 그림([창+0x250], 52efe)의 수다. 그 그림은 배경 0x41230 을 한 번 더 그리므로
 * 배경이 스스로 올리는 칸(전광판 글자 자리 [구장+0x8c] — `sceneCloudClock.sceneScoreboardTickOf`)이 이 수를 더 센다
 */
export function gameSceneFreezeSerialNow(): number {
  return freezeSerial
}

/**
 * 창이 선 첫 그림([창+0x250]) 중 배경 0x41230 을 그린 그림의 수 — 52f26~52f36 은 상태 [장면+0x1c] 가 7 · 9 · 8(로딩 판)이면 0x41230 을
 * 건너뛴다(2026-10-24 직접 떴다). 그래서 로딩 판 동안 선 창은 전광판 글자 자리 [구장+0x8c] 를 줄이지 않는다
 * (`sceneCloudClock.sceneScoreboardTickOf`)
 */
export function gameSceneBackdropFreezeSerialNow(): number {
  return backdropFreezeSerial
}

/**
 * 경기 장면 로딩 판(상태 7 · 9 · 8)이 서 있는 동안 센다 — 그때 선 창의 첫 그림은 배경 0x41230 을 안 그린다(52f28~52f32).
 * 같은 판의 `useMarksGameScene` 보다 **먼저** 불러야 판이 서는 커밋에 이미 떠 있던 창도 로딩 판 몫으로 센다
 */
export function useMarksGameSceneLoading(): void {
  useLayoutEffect(() => markGameSceneLoading(), [])
}

/** 로딩 판 하나가 섰다 — 돌려준 함수로 내린다(`useMarksGameSceneLoading`) */
export function markGameSceneLoading(): () => void {
  loadingScenesUp += 1
  const generation = testGeneration
  let released = false
  return () => {
    if (released || generation !== testGeneration) return
    released = true
    loadingScenesUp -= 1
  }
}

export interface GameSceneDrawGate {
  readonly allowsDraw: () => boolean
}

export function createGameSceneDrawGate(): GameSceneDrawGate {
  let seenSerial = frozenSince === null ? -1 : freezeSerial
  return {
    allowsDraw: () => {
      if (frozenSince === null) return true
      if (seenSerial === freezeSerial) return false
      seenSerial = freezeSerial
      return true
    },
  }
}

/** 경기 장면 화면 하나가 섰다 — 돌려준 함수로 내린다(`useMarksGameScene`) */
export function markGameSceneUp(): () => void {
  gameScenesUp += 1
  syncGameSceneFreeze()
  const generation = testGeneration
  let released = false
  return () => {
    // 시험이 셈을 되돌린 뒤 늦게 내리는 화면은 무시한다
    if (released || generation !== testGeneration) return
    released = true
    gameScenesUp -= 1
    syncGameSceneFreeze()
  }
}

/**
 * 경기 장면(0x104)이 서 있는가 — 그 장면의 받은 키는 장면 부품의 칸(`sceneKeyLatch` — 장면 틱)이 맡는다. 앱 키 문(`appKeyGate`)은
 * 장면이 서 있고 창이 없을 때 키를 그 칸에 그대로 넘긴다
 */
export function isGameSceneUp(): boolean {
  return gameScenesUp > 0
}

/** 경기 장면 0x52c50 이 52cc6 · 52efe · 53048 에서 이 그림을 건너뛰는가 (`gameScenesUp` 머리말) */
export function isGameSceneFrozen(): boolean {
  return frozenSince !== null
}

/**
 * **경기 장면 시계** — 실제 시각 `raw`(`performance.now()` · requestAnimationFrame 시각)를 장면이 흐른 시각으로 바꾼다.
 * 장면이 멈춘 동안은 멈춘 시각에 서 있고, 풀리면 멈춰 있던 만큼 빼고 이어 흐른다(52cc6 — 건너뛴 틱을 따라잡지 않는다).
 * 경기 장면 부품이 쓰는 시각(단계 시작 · 키를 받은 시각 · 그림 시각)은 모두 이 시계로 재야 서로 맞는다.
 */
export function gameSceneTimeOf(raw: number): number {
  return (frozenSince === null ? raw : Math.min(raw, frozenSince)) - frozenTotal
}

/** 지금 경기 장면 시각 — `gameSceneTimeOf(performance.now())` */
export function gameSceneNow(): number {
  return gameSceneTimeOf(performance.now())
}

/**
 * **경기 장면 틱** — 경기 장면 시계(`gameSceneTimeOf`)를 그림 길이(`millisecondsPerFrame()`)로 센 정수. 원본 경기 장면 0x52c50 은 한 틀에
 * 한 번 갱신하고(52cd4 의 0xbc9c9 — 상태 틱 [장면+0x2c] +1 · 진입) 한 번 그린다 — 이 틱 하나가 그 틀이다. 장면 부품은 단계 시작을
 * **그 단계가 선 장면 틱 번호**로 적고 단계 안 진행은 (지금 틱 − 시작 틱)으로 센다 — 그래서 그림은 틱마다 많아야 한 번 바뀌고,
 * 단계 경계가 모두 같은 격자 위에 선다. 창이 떠 있는 동안은 시계가 서므로 틱도 안 오른다(52cc6 — 따라잡지 않는다).
 *
 * 틱은 따로 기준점을 잡지 않고 **앱 틱(`frameClock`)에서 멈춰 있던 앱 틱 수를 뺀 값**이다(r160). 원본은 앱 루프 하나가 틀을 돌리고
 * 경기 장면은 창이 선 틀에 갱신만 건너뛴다 — 틀 머리는 늘 앱 틀이다. 예전처럼 장면 시각(ms)에 따로 격자를 깔면 멈춘 ms 만큼 격자가
 * 틀 안쪽으로 밀리고, 창이 떠 있는 동안 속도를 바꾸면 앱 틱과 장면 틱이 서로 다른 때에 기준점을 다시 잡았다.
 *
 * 상태가 바뀌는 틱(2026-10-24 직접 떴다): 0xbcb48(상태 객체, 새 상태)이 +8 에 예약만 하고, 다음 틀 머리 0xbc9c8 이
 * `+4 ≠ +8` 이면 +0x10 = 옛 상태 · **+0x14(틱) = 0** · +4 = 새 상태 · +0x19(진입) = 1 을 적는다(bc9e8~bc9f4). 같으면 +0x14 += 1 ·
 * +0x19 = 0 (bc9de~bc9e4). 경기 장면은 그 뒤 52cdc 에서 [장면+0x31](진입)이 서 있으면 진입 표 0xd04bc 를 부르고, 52d9e 의 키 0x498d4 ·
 * 52e14~ 의 갱신 표 0xd0530 이 같은 틀에 틱 0 으로 돈다. 곧 **갱신에서 예약한 상태는 다음 틀이 틱 0 이다** — 웹 루프는 앞 단계의
 * 끝 틱을 본 그 틀(= 원본의 예약 다음 틀)에 새 단계를 세우므로 그 틀의 장면 틱이 새 단계의 시작 틱이다.
 */
export function gameSceneTickOf(sceneTime: number): number {
  const appTick = appTickOf(sceneTime + frozenTotal)
  // 서 있는 동안은 창이 선 앱 틱에 머문다(그 뒤 시각을 받아도 오르지 않는다)
  return (frozenSinceAppTick === null ? appTick : Math.min(appTick, frozenSinceAppTick)) - frozenTicks
}

/** 지금 장면 틱 — `gameSceneTickOf(gameSceneNow())` */
export function gameSceneTickNow(): number {
  return gameSceneTickOf(gameSceneNow())
}

/** 장면 틱 `tick` 이 시작하는 경기 장면 시각(ms) — 그 틱의 앱 틱 머리를 장면 시계로 옮긴 값 */
export function gameSceneTickStartTime(tick: number): number {
  return appTickStartTime(tick + frozenTicks) - frozenTotal
}

/** 장면 틱 `tick` 이 든 앱 틱 — 앱 전역 셈(파티클 관리자 틱 표지 따위)을 장면 부품이 같은 틀로 맞출 때 */
export function appTickOfGameSceneTick(tick: number): number {
  return tick + frozenTicks
}

/**
 * **장면 틱으로 재는 setTimeout** — 지금 틱에서 `ticks` 틱 뒤의 틀 머리에 `callback` 을 부른다. 상태 길이(그림 수)를 시각으로
 * 곱해 걸면 건 때가 틱 안쪽이라 끝도 틱 안쪽에 선다 — 이 시계는 끝을 장면 틱 격자에 맞춘다(`setGameSceneTimeout` 위에 선다 —
 * 창이 떠 있는 동안 선다).
 */
export function setGameSceneTickTimeout(callback: () => void, ticks: number): number {
  return addSceneTimer(callback, 0, gameSceneTickNow() + Math.max(0, ticks))
}

/**
 * **장면 틱 머리마다 부르는 setInterval** — `window.setInterval(…, millisecondsPerFrame())` 대신 경기 장면 부품(구질 목록 · 조준 ·
 * 게이지 따위)이 장면 틱 격자에 맞춰 센다. 공용 창이 서 있는 동안(장면 시계가 선다)은 실제 시각 한 틀마다 부른다 — 부르는 쪽이
 * `isGameSceneFrozen` 으로 갱신을 거르고 창이 선 첫 그림(`createGameSceneDrawGate`)을 센다. 돌려준 함수로 거둔다.
 */
export function setGameSceneTickInterval(callback: () => void): () => void {
  return setTickInterval(
    callback,
    { now: gameSceneNow, tickOf: gameSceneTickOf, startTimeOf: gameSceneTickStartTime },
    isGameSceneFrozen,
  )
}

/** 시험용 — 센 수를 되돌린다 */
export function resetCommonWindowShownForTest(): void {
  resetAppTickClockForTest()
  testGeneration += 1
  shownCommonWindows = 0
  gameScenesUp = 0
  loadingScenesUp = 0
  // 붙잡혀 있던 시계는 다시 흘린다
  syncGameSceneFreeze()
  frozenSince = null
  frozenSinceAppTick = null
  frozenTotal = 0
  frozenTicks = 0
}
