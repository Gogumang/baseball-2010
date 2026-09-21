import { useEffect } from 'react'
import type { PointerEvent } from 'react'
import { STAGE_WIDTH } from '@/widgets/batting-stage/lib/renderBattingStage'
import type { StageRefs } from '@/widgets/batting-stage/model/stageRefs'

/** 이만큼 길게 누르고 떼면 번트 자세 토글 (모바일용, 웹판 추가) */
const BUNT_HOLD_MILLISECONDS = 350
/** 화면 좌우 이 비율 안쪽을 누르면 타자를 옮긴다 (모바일용, 웹판 추가) */
const SHIFT_EDGE_RATIO = 0.25

export interface StageActions {
  readonly swing: (now: number) => void
  readonly toggleBunt: (kind: number, now: number) => void
  readonly moveBatter: (direction: -1 | 1) => void
  /**
   * **필살타법** — 원본 `0x535a4` 의 '0' 가지(메시지 **0x6a6**, I-controls 0절).
   *
   * 성공하면 그 타구에 "송구공" 비트가 붙어 **야수가 잡지 못한다** (0x51800, S13 6절 확정) —
   * 판정 쪽은 `features/defense-play` 의 `isUncatchable` 이 이미 받아 준다.
   *
   * ⚠️ 이 고리는 **키만** 받는다. 스윙을 필살로 굴리는 확률(0x34c74 — 레벨별 15·20·25·25·30%,
   * 마타자 30%)과 그 결과를 타석 판정에 태우는 길은 `widgets/batting-stage/ui/BattingStage` 가
   * `specialSwing` 을 넘겨 줘야 이어진다. 안 넘기면 '0' 키는 아무 일도 하지 않는다.
   */
  readonly specialSwing?: (now: number) => void
}

/**
 * 원본 키 배치 (0x53670): OK·5 스윙 · 4/← 6/→ 타자 이동 · 8/7/9 번트 종류 1/2/3(다시 누르면 취소)
 * · **'0' 필살타법**(0x535a4 → 메시지 0x6a6).
 * Shift 는 번트 1 을 누르는 웹판 편의 키다.
 */
const BUNT_KEYS: Readonly<Record<string, number>> = { '8': 1, '7': 2, '9': 3, Shift: 1 }
const SWING_KEYS: ReadonlySet<string> = new Set([' ', 'Enter', '5'])
const LEFT_KEYS: ReadonlySet<string> = new Set(['ArrowLeft', '4'])
const RIGHT_KEYS: ReadonlySet<string> = new Set(['ArrowRight', '6'])
/** 필살타법 (0x535a4 의 '0' → 0x6a6) */
const SPECIAL_SWING_KEY = '0'

export function useStageControls(refs: StageRefs, actions: StageActions) {
  const { pointerDownAtRef, latestRef } = refs

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
        actions.toggleBunt(BUNT_KEYS[event.key], now)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [actions])

  return {
    onPointerDown: (event: PointerEvent<HTMLCanvasElement>) => {
      event.preventDefault()
      pointerDownAtRef.current = performance.now()
    },

    onPointerUp: (event: PointerEvent<HTMLCanvasElement>) => {
      event.preventDefault()
      const bounds = event.currentTarget.getBoundingClientRect()
      const x = ((event.clientX - bounds.left) / bounds.width) * STAGE_WIDTH
      const now = performance.now()
      if (x < STAGE_WIDTH * SHIFT_EDGE_RATIO) return actions.moveBatter(-1)
      if (x > STAGE_WIDTH * (1 - SHIFT_EDGE_RATIO)) return actions.moveBatter(1)
      const isLongPress = now - pointerDownAtRef.current >= BUNT_HOLD_MILLISECONDS
      if (isLongPress && latestRef.current.canBunt) return actions.toggleBunt(1, now)
      actions.swing(now)
    },
  }
}
