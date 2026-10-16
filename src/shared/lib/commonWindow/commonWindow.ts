import { createContext, useContext, useLayoutEffect } from 'react'

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
/** `resetCommonWindowShownForTest` 마다 오른다 */
let testGeneration = 0

function syncGameSceneFreeze(now: number = performance.now()): void {
  const isFrozen = gameScenesUp > 0 && shownCommonWindows > 0
  if (isFrozen && frozenSince === null) frozenSince = now
  else if (!isFrozen && frozenSince !== null) {
    frozenTotal += Math.max(0, now - frozenSince)
    frozenSince = null
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

/** 시험용 — 센 수를 되돌린다 */
export function resetCommonWindowShownForTest(): void {
  testGeneration += 1
  shownCommonWindows = 0
  gameScenesUp = 0
  frozenSince = null
  frozenTotal = 0
}
