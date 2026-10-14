import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'

/**
 * **공용 창 [0x140005c] 의 0x741a0 계열 여닫기** — 그리기 · 키 콜백을 받는 창(칭호 · 스킬 보상 · 이벤트 미션 · 기록 고르기 …).
 * 0x741a0 · 0x742a8 · 0x74360 · 0x754f8 · 0x75440 직접 뜸(2026-10-14):
 * ```
 * 0x741a0  [창+9] ≠ 0(떠 있음)이면 대기 칸에만 적는다: [+0x2a4] = 1 · [+0x3b0] 높이 · [+0x3b4] 그리기 · [+0x3b8] 키 · [+0x3bc] 인자
 *          아니면 [+0x20e] 목표 높이 = 인자 · [+0x212] 그리는 높이 = 6 · [+0x210] 폭 = W · [+8] 종류 = 8 · [+0x214] 펼침 = 1 ·
 *          [+0x290] = 1 · [+0x243] 키 표 수 = 0 · [+0x220] 그리기 · [+0x224] 키 · [+0x22c] 인자 · 격자 [+0x218] 지움
 * 0x754f8  키 갱신(장면이 틀마다 부른다, [창+9] 이면 늘 1):
 *          [+0x290] == 0 → [+0x214] 끔 · [+0x215] 면 닫힘 콜백 [+0x228] · 0x742a8 · 0x75440 (줄임 없이 다음 갱신에 닫힘)
 *   75556  [+0x214](펼침) → 높이 × 2 를 적고, 목표 < 두 배면 높이 = 목표 · 펼침 끔. **키는 안 본다**
 *   7558a  [+0x215](닫힘) → 폭 ÷ 2, 99 이하면 [+0x215] 끔 · 닫힘 콜백 · 0x742a8 · **0x75440**(대기 칸을 띄운다). **키는 안 본다**
 *   755da  격자 · 키 표([+0x234] → 답 [+0x21c] · [+0x215] = 1 · [+0x24e] 면 폭 = 0)
 *   756c2  종류 8 이고 [+0x224] 면 키 콜백(인자, 키)
 * 0x742a8  [+9] = 0 · [+8] = 0 — 그 자리에서 치운다. 0x75440 을 안 부른다
 * 0x74360  0x742a8 과 같고 답 [+0x21c] = 둘째 인자 (이름 입력 0x32b7c · 선수 목록 창 0x63368 이 부른다)
 * ```
 * 그래서 닫는 길은 키 콜백이 무엇을 하느냐로 갈린다:
 *   - **바로**(`'바로'`) — 키 콜백이 0x742a9 · 0x74361 을 부른다. 키를 받은 그 그림부터 창이 없고 대기 칸도 안 띄운다.
 *     칭호 0x1b1e4 · 스킬 보상 0x8e054 · 시즌 기록순위 0xf5d4 · 시즌 팀 트레이닝 결과 0xf2c8 · 나리 훈련 결과 0x1b4c4 ·
 *     휴식 결과 0x1b308 · 장비 구매 확정 0x1d648 · 이름 입력 0x32b7c · 선수 목록 창 0x63368.
 *   - **줄임**(`'줄임'`) — 키 콜백이 [창+0x215] = 1 을 쓴다. 다음 갱신부터 폭 240 → 120 → 60(닫힘 · 0x75440).
 *     나리 기록실 0x196ec · 투수 구질 0x19398 · 이벤트 미션 0x1dcb0 · 경기 중 메뉴 0x3c158.
 *     줄이는 동안에도 그리기 콜백은 돈다(0x7479c 는 [+0x214] 만 본다) — 판만 가운데로 줄고((W − 폭)/2, 0x744c4) 글은 안 잘린다.
 *     목표 높이 0 인 창(판 없음 — 0x744c4 는 [+0x20e] == 0 이면 안 그린다)은 줄임이 안 보이고 글만 두 갱신 더 남는다.
 *   - 띄운 쪽이 [창+0x290] = 0 으로 두면(이벤트 system sub 2 — 0x8d39e~0x8d3a8) 0x754f8 첫 갈래가 다음 갱신에 [+0x214] 를 끄고
 *     키도 그 갱신에 받으며, [+0x215] 가 서면 다음 갱신에 줄임 없이 닫는다(`expands: false`).
 */

/** 0x741a0 의 [창+0x212] — 처음 그리는 높이 */
export const POPUP_OPEN_START_HEIGHT = 6
/** 0x741a0 의 [창+0x210] — 폭 = 화면 폭 */
export const POPUP_CLOSE_START_WIDTH = 240
/** 0x755aa `cmp r1, #0x63` — 이 폭 이하가 되면 닫힌다 */
export const POPUP_CLOSE_END_WIDTH = 99

export type PopupCloseKind = '바로' | '줄임'

/**
 * 펼침 한 갱신 (0x75562~0x75586): 두 배를 먼저 적고, **목표 < 두 배** 일 때만 목표로 맞추고 펼침을 끈다.
 * 두 배가 목표와 같으면 펼침이 한 갱신 더 남는다(그동안 글은 안 그리고 키도 안 본다). 다 펼쳤으면 null.
 */
export function nextPopupOpeningHeight(height: number, targetHeight: number): number | null {
  const doubled = height * 2
  return targetHeight < doubled ? null : doubled
}

/** 닫힘 한 갱신 (0x75596~0x755ae): 폭 ÷ 2(0 쪽으로 자름), 99 이하면 닫힌다 — null */
export function nextPopupClosingWidth(width: number): number | null {
  const halved = Math.trunc(width / 2)
  return halved > POPUP_CLOSE_END_WIDTH ? halved : null
}

export interface PopupWindowMotion {
  /** 펼치는 동안 그리는 높이 — 다 펼쳤으면 null. 이 동안 판만 긋고 글은 안 그린다(0x7479c) */
  readonly openingHeight: number | null
  /** 줄이는 동안의 폭 — 줄이지 않으면 null */
  readonly closingWidth: number | null
  /** 창이 치워졌다 — 부르는 쪽이 아직 내리지 않았어도 그리지 않는다 */
  readonly isClosed: boolean
  /** 지금 키를 받는가 — 펼치는 동안 · 줄이는 동안 · 닫힌 뒤는 아니다 (0x75556 · 0x7558a) */
  readonly acceptsKeys: () => boolean
  /**
   * 키 콜백이 창을 닫는다. `onClosed` 는 창이 치워진 때 — `'바로'` 면 그 자리, `'줄임'` 이면 폭이 99 이하가 된 갱신이다.
   * 키를 안 받는 때면 아무것도 안 하고 false.
   */
  readonly close: (kind: PopupCloseKind, onClosed?: () => void) => boolean
}

/**
 * 0x741a0 창 하나의 펼침 · 닫힘. 갱신 한 번 = 원본 틀 하나(`millisecondsPerFrame`).
 * `skipsMotion` 이 참이면(레이아웃이 없는 시험 환경 따위) 다 펼친 채로 시작하고 `'줄임'` 도 바로 닫는다 — `MessageBox` 와 같은 약속.
 */
export function usePopupWindowMotion({ targetHeight, skipsMotion = false, expands = true }: {
  /** [창+0x20e] — 0x741a0 의 둘째 인자 */
  readonly targetHeight: number
  readonly skipsMotion?: boolean
  /**
   * [창+0x290] — 0x741a0 은 1 이다. 0 이면(띄운 쪽이 끈 자리) 0x754f8 첫 갈래(0x7550a~0x75552)가 펼침을 다음 갱신에 끄고 그 갱신에
   * 키를 받으며, 닫힘([+0x215])은 다음 갱신에 줄임 없이 치운다. 첫 그림은 여전히 [+0x214] 라 글을 안 그린다.
   */
  readonly expands?: boolean
}): PopupWindowMotion {
  const [openingHeight, setOpeningHeight] = useState<number | null>(skipsMotion ? null : POPUP_OPEN_START_HEIGHT)
  const [closingWidth, setClosingWidth] = useState<number | null>(null)
  const [isClosed, setIsClosed] = useState(false)
  // 틀 · 키는 그리기를 기다리지 않고 이 값을 본다 — 틀 여럿이 한 그리기에 묶여도 한 틀씩 나아간다
  const openingRef = useRef(openingHeight)
  const closingRef = useRef(closingWidth)
  const isClosedRef = useRef(false)
  const onClosedRef = useRef<(() => void) | undefined>(undefined)
  const skipsMotionRef = useRef(skipsMotion)
  skipsMotionRef.current = skipsMotion
  const expandsRef = useRef(expands)
  expandsRef.current = expands

  const finish = useCallback(() => {
    isClosedRef.current = true
    closingRef.current = null
    setClosingWidth(null)
    setIsClosed(true)
    const onClosed = onClosedRef.current
    onClosedRef.current = undefined
    onClosed?.()
  }, [])

  // 레이아웃을 재 보고서야 아는 자리(첫 그림 뒤에 참이 된다) — 펼침을 건너뛴다
  useLayoutEffect(() => {
    if (!skipsMotion || openingRef.current === null) return
    openingRef.current = null
    setOpeningHeight(null)
  }, [skipsMotion])

  const isMoving = openingHeight !== null || closingWidth !== null
  useEffect(() => {
    if (!isMoving || isClosedRef.current) return undefined
    const timer = window.setInterval(() => {
      if (isClosedRef.current) return
      if (openingRef.current !== null) {
        const next = expandsRef.current ? nextPopupOpeningHeight(openingRef.current, targetHeight) : null
        openingRef.current = next
        return setOpeningHeight(next)
      }
      if (closingRef.current === null) return
      const next = nextPopupClosingWidth(closingRef.current)
      if (next === null) return finish()
      closingRef.current = next
      setClosingWidth(next)
    }, millisecondsPerFrame())
    return () => window.clearInterval(timer)
  }, [isMoving, targetHeight, finish])

  const acceptsKeys = useCallback(
    () => (openingRef.current === null || !expandsRef.current) && closingRef.current === null && !isClosedRef.current,
    [],
  )

  const close = useCallback((kind: PopupCloseKind, onClosed?: () => void) => {
    if (!acceptsKeys()) return false
    onClosedRef.current = onClosed
    if (kind === '바로' || skipsMotionRef.current) {
      finish()
      return true
    }
    // [+0x290] == 0 이면 다음 갱신의 첫 갈래가 줄임 없이 닫는다 — 폭 0 은 다음 갱신에 닫히는 값이다
    const width = expandsRef.current ? POPUP_CLOSE_START_WIDTH : 0
    openingRef.current = null
    setOpeningHeight(null)
    closingRef.current = width
    setClosingWidth(width)
    return true
  }, [acceptsKeys, finish])

  return { openingHeight, closingWidth, isClosed, acceptsKeys, close }
}

/**
 * 판 꼴 — 그리기 0x744c4: x = (W − 폭) / 2 · y = (H − 높이) / 2. 펼치는 동안은 높이만, 줄이는 동안은 폭만 바뀐다.
 * (CSS 상자는 세로 가운데를 이미 맞추므로 높이 · 가로 자리 · 폭만 준다.)
 */
export function popupBoxStyleOf(motion: Pick<PopupWindowMotion, 'openingHeight' | 'closingWidth'>, fullHeight: number) {
  const width = motion.closingWidth ?? POPUP_CLOSE_START_WIDTH
  return {
    height: motion.openingHeight ?? fullHeight,
    left: Math.trunc((POPUP_CLOSE_START_WIDTH - width) / 2),
    width,
  }
}
