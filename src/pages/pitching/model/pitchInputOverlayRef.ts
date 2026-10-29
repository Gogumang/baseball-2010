import { useEffect, useLayoutEffect, useRef } from 'react'
import type { PitchInputOverlay } from '@/widgets/batting-stage/lib/pitchInputOverlay'

/**
 * 사람 투구 UI 의 그림 재료를 장면에 넘기는 칸 — 구질 · 조준 · 게이지 단추가 쓰고, 장면(`PitcherSideStage`)이 그림마다 읽는다.
 * 원본은 그 셋을 상태 그리기 0x4c4bc · 0x4d780 · 0x4d2ac 가 장면 위에 그린다 (`widgets/batting-stage/lib/pitchInputOverlay`).
 */
export interface PitchInputOverlayRef {
  current: PitchInputOverlay | null
}

export function usePitchInputOverlayRef(): PitchInputOverlayRef {
  return useRef<PitchInputOverlay | null>(null)
}

/** 지금 값을 칸에 싣고, 내려갈 때 제가 실은 값이면 비운다 */
export function usePublishedOverlay(ref: PitchInputOverlayRef | undefined, overlay: PitchInputOverlay | null): void {
  const publishedRef = useRef<PitchInputOverlay | null>(null)
  // 커밋 때 싣는다 — 장면은 rAF 그리기(flushSync 로 커밋까지 마친 뒤)에서 읽는다
  useLayoutEffect(() => {
    if (ref === undefined || overlay === null) return
    ref.current = overlay
    publishedRef.current = overlay
  })
  useEffect(
    () => () => {
      if (ref !== undefined && ref.current === publishedRef.current) ref.current = null
    },
    [ref],
  )
}
