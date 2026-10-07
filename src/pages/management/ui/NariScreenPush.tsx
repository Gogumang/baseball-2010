import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { nariMatchPushDirectionOf, screenPushFrameAt } from '@/pages/management/lib/nariScreenPush'
import type { NariMatchPushView, ScreenPushDirection, ScreenPushFrame } from '@/pages/management/lib/nariScreenPush'
import * as styles from '@/pages/management/ui/NariScreenPush.css'

/** 원본 픽셀을 확대 배율에 맞춘 길이 */
const scaled = (pixels: number) => `calc(var(--zoom) * ${pixels}px)`
const translate = (x: number, y: number) => `translate(${scaled(x)}, ${scaled(y)})`

interface NariScreenPushProps {
  /** 지금 선 화면 — 바뀌면 `nariMatchPushDirectionOf` 의 방향으로 민다 */
  readonly view: NariMatchPushView
  readonly children: ReactNode
}

/**
 * **142 ↔ 143 화면 밀기** (효과기 종류 8, `pages/management/lib/nariScreenPush` 머리말).
 * 원본은 효과를 걸 때 지금 화면을 떠 두고(0xbda00) 갱신마다 새 화면을 옮긴 위에 떠 둔 화면을 그린다. 웹은 화면이 바뀔 때
 * 앞 화면의 DOM 을 복제해 두었다가 같은 자리에 겹친다 — 복제본은 키를 받지 않으므로(옛 화면의 키 처리는 이미 떠났다)
 * 그동안 키는 새 상태의 것만 먹는다.
 */
export function NariScreenPush({ view, children }: NariScreenPushProps) {
  const liveRef = useRef<HTMLDivElement>(null)
  const snapshotHostRef = useRef<HTMLDivElement>(null)
  /** 마지막으로 그린 화면의 복제 — 다음 화면이 설 때 옛 화면으로 쓴다 */
  const lastSnapshotRef = useRef<Node | null>(null)
  const viewRef = useRef(view)
  const handleRef = useRef(0)
  const [push, setPush] = useState<{ direction: ScreenPushDirection; frame: ScreenPushFrame } | null>(null)

  useEffect(() => () => cancelAnimationFrame(handleRef.current), [])

  useLayoutEffect(() => {
    const previous = viewRef.current
    if (previous !== view) {
      viewRef.current = view
      const direction = nariMatchPushDirectionOf(previous, view)
      const host = snapshotHostRef.current
      const snapshot = lastSnapshotRef.current
      const first = direction === null ? null : screenPushFrameAt(direction, 0)
      if (direction !== null && first !== null && host !== null && snapshot !== null) {
        // 0xbdae8 — 새로 걸면 앞 효과를 덮는다(전역 하나)
        cancelAnimationFrame(handleRef.current)
        host.replaceChildren(snapshot)
        setPush({ direction, frame: first })
        const startedAt = performance.now()
        const tick = (now: number) => {
          const current = screenPushFrameAt(direction, Math.floor((now - startedAt) / millisecondsPerFrame()))
          if (current === null) {
            // 끝 다음 프레임에 효과기를 비운다(bd852) — 떠 둔 화면을 버린다
            host.replaceChildren()
            setPush(null)
            return
          }
          setPush({ direction, frame: current })
          handleRef.current = requestAnimationFrame(tick)
        }
        handleRef.current = requestAnimationFrame(tick)
      }
    }
    // 지금 화면을 떠 둔다 — 다음에 화면이 바뀌면 이것이 옛 화면이다
    lastSnapshotRef.current = liveRef.current?.firstElementChild?.cloneNode(true) ?? null
  })

  return (
    <div className={styles.frame}>
      <div ref={liveRef} style={push === null ? undefined : { transform: translate(push.frame.newX, push.frame.newY) }}>
        {children}
      </div>
      <div
        ref={snapshotHostRef}
        className={styles.snapshot}
        aria-hidden
        style={push === null ? { display: 'none' } : { transform: translate(push.frame.oldX, push.frame.oldY) }}
      />
    </div>
  )
}
