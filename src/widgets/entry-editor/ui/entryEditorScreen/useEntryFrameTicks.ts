import { useEffect, useRef } from 'react'
import { setAppTickInterval } from '@/shared/lib/frameClock/frameClock'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'

/**
 * 그림 한 틀 — 열 밀기 한 단계(0x5c984) · 메인 메뉴의 틀마다 키 셈. 열 밀기가 서 있거나 `ticksEveryFrame` 일 때만 틀마다 `onFrame` 을 부른다
 */
export function useEntryFrameTicks(onFrame: (() => void) | undefined, isSliding: boolean, ticksEveryFrame: boolean): void {
  const frameRef = useRef(onFrame)
  useMirrorRef(frameRef, onFrame)
  const hasFrame = onFrame !== undefined
  useEffect(() => {
    if (!hasFrame || (!isSliding && !ticksEveryFrame)) return undefined
    const timer = setAppTickInterval(() => frameRef.current?.())
    return () => timer()
  }, [hasFrame, isSliding, ticksEveryFrame])
}
