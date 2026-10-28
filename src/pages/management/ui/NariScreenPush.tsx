import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { appTickNow, appTickOf } from '@/shared/lib/frameClock/frameClock'
import type { ReactNode } from 'react'
import { nariMatchPushDirectionOf, screenPushFrameAt } from '@/pages/management/lib/nariScreenPush'
import type { NariMatchPushView, ScreenPushDirection, ScreenPushFrame } from '@/pages/management/lib/nariScreenPush'
import * as styles from '@/pages/management/ui/NariScreenPush.css'

/** 원본 픽셀을 확대 배율에 맞춘 길이 */
const scaled = (pixels: number) => `calc(var(--zoom) * ${pixels}px)`
const translate = (x: number, y: number) => `translate(${scaled(x)}, ${scaled(y)})`

interface NariScreenPushProps<V extends string> {
  /** 지금 선 화면 — 바뀌면 `directionOf` 의 방향으로 민다 */
  readonly view: V
  /** 앞 화면 → 새 화면의 밀기 방향(없으면 null). 안 주면 나리 142 ↔ 143 (`nariMatchPushDirectionOf`) */
  readonly directionOf?: (from: V, to: V) => ScreenPushDirection | null
  readonly children: ReactNode
}

/**
 * **142 ↔ 143 화면 밀기** (효과기 종류 8, `pages/management/lib/nariScreenPush` 머리말). 일반모드 준비 18 ↔ 19 · 22 ↔ 23 도
 * 같은 효과기를 건다(`directionOf`, 메인 메뉴 장면 키 누름 0x246d8 도 같은 효과기 문 — A-68).
 * 원본은 효과를 걸 때 지금 화면을 떠 두고(0xbda00) 갱신마다 새 화면을 옮긴 위에 떠 둔 화면을 그린다. 웹은 화면이 바뀔 때
 * 앞 화면의 DOM 을 복제해 두었다가 같은 자리에 겹친다.
 *
 * **밀기 동안은 키를 아무도 못 받는다** (직접 떴다): 나리 장면 vtable 0xcc2fc 의 키 누름 0x10758 · 키 뗌 0x10774 가
 * `[eff+4] == 0 || [eff+0x10] == 0` 일 때만 장면+0x38 · +0x3c 에 키를 적는다(0x1075c~0x1076a, eff = [0x140007c]) — 효과기가 도는 동안
 * (+4 = 8 · +0x10 = 1/2) 들어온 키는 버려지고 쌓이지도 않는다(매 틀 0xbca04 가 +0x38 을 지운다, 0xbcb04). 그래서 앞 화면도 새 화면
 * (142 키 0x13c30 · 143 0x1457c)도 못 받고, 효과기를 비운 뒤(0xbd852)부터 받는다. 웹은 밀기가 서 있는 동안 키를 삼키고 누름도 막는다.
 * 효과를 건 틀은 시작 0xbdae8 이 +0x10 = 0 으로 두어 그 틀 꼬리의 그리기 0xbd844(+0x10 = 1, 0xbd882)까지는 문이 열려 있지만,
 * 거는 갱신과 꼬리는 한 함수 안이다 — 나리 틱 0x1cdec 가 맨 앞 0xbca04 → 상태 갱신(키 처리 · 효과 걸기) → 그리기 → 끝(0x1d4a4)의
 * 0xbd845 를 한 번에 부르고, 키 누름 0x10758 은 따로 불려 칸에 적기만 한다. 그래서 그 사이에 들어오는 키는 없고, 거는 순간부터
 * 막는 웹과 같다(시즌 틱 0xe9ac 도 끝 0xf136 에서 0xbd845 를 부른다).
 */
export function NariScreenPush<V extends string = NariMatchPushView>({ view, directionOf, children }: NariScreenPushProps<V>) {
  const liveRef = useRef<HTMLDivElement>(null)
  const snapshotHostRef = useRef<HTMLDivElement>(null)
  /** 마지막으로 그린 화면의 복제 — 다음 화면이 설 때 옛 화면으로 쓴다 */
  const lastSnapshotRef = useRef<Node | null>(null)
  const viewRef = useRef(view)
  const handleRef = useRef(0)
  const [push, setPush] = useState<{ direction: ScreenPushDirection; frame: ScreenPushFrame } | null>(null)

  useEffect(() => () => cancelAnimationFrame(handleRef.current), [])

  // 0x10758 · 0x10774 — 효과기가 도는 동안 키 누름 · 뗌을 버린다. 자식 화면의 키 처리기(useEffect)보다 먼저 걸리도록
  // 처음 붙을 때 레이아웃 효과에서 window 잡는 단계에 한 번 건다
  const isPushingRef = useRef(false)
  isPushingRef.current = push !== null
  useLayoutEffect(() => {
    const swallow = (event: KeyboardEvent) => {
      if (!isPushingRef.current) return
      event.stopImmediatePropagation()
      event.preventDefault()
    }
    window.addEventListener('keydown', swallow, true)
    window.addEventListener('keyup', swallow, true)
    return () => {
      window.removeEventListener('keydown', swallow, true)
      window.removeEventListener('keyup', swallow, true)
    }
  }, [])

  useLayoutEffect(() => {
    const previous = viewRef.current
    if (previous !== view) {
      viewRef.current = view
      const direction =
        directionOf === undefined
          ? nariMatchPushDirectionOf(previous as string as NariMatchPushView, view as string as NariMatchPushView)
          : directionOf(previous, view)
      const host = snapshotHostRef.current
      const snapshot = lastSnapshotRef.current
      const first = direction === null ? null : screenPushFrameAt(direction, 0)
      if (direction !== null && first !== null && host !== null && snapshot !== null) {
        // 0xbdae8 — 새로 걸면 앞 효과를 덮는다(전역 하나)
        cancelAnimationFrame(handleRef.current)
        host.replaceChildren(snapshot)
        setPush({ direction, frame: first })
        const startTick = appTickNow()
        const tick = (now: number) => {
          const current = screenPushFrameAt(direction, Math.max(0, appTickOf(now) - startTick))
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
      <div ref={liveRef} style={push === null ? undefined : { transform: translate(push.frame.newX, push.frame.newY), pointerEvents: 'none' }}>
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
