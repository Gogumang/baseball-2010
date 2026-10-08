import { useEffect, useRef } from 'react'
import type { PointerEvent } from 'react'
import { STAGE_WIDTH } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { StageRefs } from '@/widgets/batting-stage/model/stageRefs'

/** 이만큼 길게 누르고 있으면 번트 자세 — 떼면 푼다 (모바일용, 웹판 추가) */
const BUNT_HOLD_MILLISECONDS = 350
/** 화면 좌우 이 비율 안쪽을 누르면 타자를 옮긴다 (모바일용, 웹판 추가) */
const SHIFT_EDGE_RATIO = 0.25

export interface StageActions {
  readonly swing: (now: number) => void
  /** 번트 키 누름 — 0x6a7 (`BattingStage` 의 `pressBunt`) */
  readonly pressBunt: (kind: number, now: number) => void
  /** 번트 키 뗌 — 0x6a8 (`BattingStage` 의 `releaseBunt`). 번트는 누르고 있는 동안만이다 */
  readonly releaseBunt: (now: number) => void
  readonly moveBatter: (direction: -1 | 1) => void
  /**
   * **필살타법** — 원본 `0x535a4` 의 '0' 가지(메시지 **0x6a6**, I-controls 0절). 거는 단계 없이
   * **그 자리에서 필살 스윙**이 나간다 (0x51dee — 일반 스윙 0x51db6 과 같은 예약, S+0x10 만 다르다).
   *
   * 성공하면 그 타구에 "송구공" 비트가 붙어 **야수가 잡지 못한다** (0x51800, S13 6절 확정) —
   * 판정 쪽은 `features/defense-play` 의 `isUncatchable` 이 이미 받아 준다.
   *
   * 이 고리는 **키만** 받는다. 남은 횟수 가드(0x51e14)·소모(0x4e136)·성공 굴림(0x34c74 — 번호별
   * 15·20·25·25%, 마타자 30%)은 `widgets/batting-stage/ui/BattingStage` 가 맡는다.
   * 안 넘기면 '0' 키는 아무 일도 하지 않는다.
   */
  readonly specialSwing?: (now: number) => void
}

/**
 * 원본 키 배치 (0x53670): OK·5 스윙 · 4/← 6/→ 타자 이동 · 8/7/9 번트 종류 1/2/3 · **'0' 필살타법**(0x535a4 → 메시지 0x6a6).
 * 번트는 **누르고 있는 동안만** 자세다 — 키 사건 +0x1c 비트 9(뗌, 0xbca04)면 0x53670 이 0x5364c 로 '7'~'9' 를 0x6a8 로 보내
 * 자세를 푼다(0x51eba). 다시 눌러 끄는 토글이 아니다.
 * Shift 는 번트 1('8')을 누르는 웹판 편의 키다 — 뗄 때도 '8' 처럼 푼다.
 */
const BUNT_KEYS: Readonly<Record<string, number>> = { '8': 1, '7': 2, '9': 3, Shift: 1 }
const SWING_KEYS: ReadonlySet<string> = new Set([' ', 'Enter', '5'])
const LEFT_KEYS: ReadonlySet<string> = new Set(['ArrowLeft', '4'])
const RIGHT_KEYS: ReadonlySet<string> = new Set(['ArrowRight', '6'])
/** 필살타법 (0x535a4 의 '0' → 0x6a6) */
const SPECIAL_SWING_KEY = '0'

export function useStageControls(refs: StageRefs, actions: StageActions) {
  const { pointerDownAtRef, latestRef } = refs
  /** 길게 누르기 번트 타이머와 그것이 번트를 걸었는지 (모바일용, 웹판 추가) */
  const buntHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isPointerBuntingRef = useRef(false)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      const now = performance.now()
      if (SWING_KEYS.has(event.key)) {
        event.preventDefault()
        actions.swing(now)
      } else if (event.key === SPECIAL_SWING_KEY) {
        // 필살타법 — 화면이 손잡이를 안 넘겼으면 원본 키만 받아 두고 아무 일도 하지 않는다
        if (actions.specialSwing === undefined) return
        event.preventDefault()
        actions.specialSwing(now)
      } else if (LEFT_KEYS.has(event.key)) {
        event.preventDefault()
        actions.moveBatter(-1)
      } else if (RIGHT_KEYS.has(event.key)) {
        event.preventDefault()
        actions.moveBatter(1)
      } else if (BUNT_KEYS[event.key] !== undefined && latestRef.current.canBunt) {
        actions.pressBunt(BUNT_KEYS[event.key], now)
      }
    }
    // 0x5364c — 뗀 키가 '7'~'9' 면 0x6a8 (종류를 가리지 않는다)
    const onKeyUp = (event: KeyboardEvent) => {
      if (BUNT_KEYS[event.key] !== undefined) actions.releaseBunt(performance.now())
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [actions])

  useEffect(
    () => () => {
      if (buntHoldTimerRef.current !== null) clearTimeout(buntHoldTimerRef.current)
    },
    [],
  )

  return {
    onPointerDown: (event: PointerEvent<HTMLCanvasElement>) => {
      event.preventDefault()
      pointerDownAtRef.current = performance.now()
      isPointerBuntingRef.current = false
      const bounds = event.currentTarget.getBoundingClientRect()
      const x = ((event.clientX - bounds.left) / bounds.width) * STAGE_WIDTH
      const isEdge = x < STAGE_WIDTH * SHIFT_EDGE_RATIO || x > STAGE_WIDTH * (1 - SHIFT_EDGE_RATIO)
      if (isEdge || !latestRef.current.canBunt) return
      if (buntHoldTimerRef.current !== null) clearTimeout(buntHoldTimerRef.current)
      // 길게 누르고 있으면 번트 1 을 누른 것으로 — 떼면 푼다(키 '8' 과 같다)
      buntHoldTimerRef.current = setTimeout(() => {
        buntHoldTimerRef.current = null
        isPointerBuntingRef.current = true
        actions.pressBunt(1, performance.now())
      }, BUNT_HOLD_MILLISECONDS)
    },

    onPointerUp: (event: PointerEvent<HTMLCanvasElement>) => {
      event.preventDefault()
      if (buntHoldTimerRef.current !== null) {
        clearTimeout(buntHoldTimerRef.current)
        buntHoldTimerRef.current = null
      }
      const now = performance.now()
      if (isPointerBuntingRef.current) {
        isPointerBuntingRef.current = false
        return actions.releaseBunt(now)
      }
      const bounds = event.currentTarget.getBoundingClientRect()
      const x = ((event.clientX - bounds.left) / bounds.width) * STAGE_WIDTH
      if (x < STAGE_WIDTH * SHIFT_EDGE_RATIO) return actions.moveBatter(-1)
      if (x > STAGE_WIDTH * (1 - SHIFT_EDGE_RATIO)) return actions.moveBatter(1)
      actions.swing(now)
    },
  }
}
