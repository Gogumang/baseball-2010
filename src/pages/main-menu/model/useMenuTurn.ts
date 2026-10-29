import { useEffect, useRef, useState } from 'react'
import { appTickNow, appTickOf } from '@/shared/lib/frameClock/frameClock'
import type { MenuTurnDirection } from '@/pages/main-menu/lib/mainMenuLayout'

export interface MenuTurn {
  /** 돌기 시작할 때 커서가 있던 칸 — 도는 동안은 **이 커서의 배열**을 그린다 */
  readonly fromCursor: number
  /** 도는 방향. null 이면 멈춰 있다 (원본 `[obj+0x100]`: ↑ −1 · ↓ −2) */
  readonly direction: MenuTurnDirection | null
  /** 0부터 세는 틱. `ticks` 에 닿으면 배열이 돌고 멈춘다. */
  readonly counter: number
}

const STILL: MenuTurn = { fromCursor: 0, direction: null, counter: 0 }

/**
 * 메뉴가 한 칸 도는 동안의 방향·카운터.
 *
 * 원본은 커서를 옮기는 동시에 **배열을 돌린다**. 다만 회전은 연출이 끝나는 마지막 틱에 한 번만
 * 일어나고(윗단 0x24c42, 아랫단 0x25386), 그 전까지는 **돌기 전 배열**을 연출값만큼 밀어서 그린다.
 * 그래서 여기서는 방향과 틱만 세고, 실제 각·스크롤 계산은 `lib/mainMenuLayout` 이 한다.
 *
 * - 윗단(바퀴): 카운터 0→4 를 그리고 5틱째에 회전한다 → `ticks = 5`
 * - 아랫단(세로 릴): 스크롤 ±1 → ±4 → ±16 석 장을 그리고 넉째에 회전한다 → `ticks = 3`
 *
 * 커서가 ±1 칸(감싸기 포함)이 아니게 튀면(마우스로 딴 칸을 바로 고르는 웹 조작) 연출 없이 붙인다 —
 * 원본에는 그런 조작이 없어 **근사**다.
 */
/** ↓ 는 커서 +1(배열 왼쪽으로), ↑ 는 −1(오른쪽으로) — 감싸기까지 원본 클램프(0x2532e)와 같다. ±1 칸이 아니면 null */
function turnDirectionOf(from: number, cursor: number, count: number): MenuTurnDirection | null {
  if (cursor === (from + 1) % count) return -2
  if (cursor === (from - 1 + count) % count) return -1
  return null
}

/** 커서가 옮겨진 그 렌더의 돌기 — 첫 틱(카운터 0)이거나, 연출 없이 붙이면 멈춤 */
function turnStartOf(from: number, cursor: number, count: number): MenuTurn {
  const direction = turnDirectionOf(from, cursor, count)
  return direction === null ? STILL : { fromCursor: from, direction, counter: 0 }
}

export function useMenuTurn(cursor: number, count: number, ticks: number): MenuTurn {
  const [turn, setTurn] = useState<MenuTurn>(STILL)
  // 커서가 옮겨진 렌더에서 곧바로 돌기를 건다(칸이 하나뿐이면 그대로) — 틱은 아래 효과가 센다
  const [shownCursor, setShownCursor] = useState(cursor)
  if (shownCursor !== cursor) {
    setShownCursor(cursor)
    if (count > 1) setTurn(turnStartOf(shownCursor, cursor, count))
  }
  const previousRef = useRef(cursor)

  useEffect(() => {
    const from = previousRef.current
    previousRef.current = cursor
    if (from === cursor || count <= 1) return undefined
    const direction = turnDirectionOf(from, cursor, count)
    if (direction === null) return undefined

    const startTick = appTickNow()
    let handle = 0
    const tick = (now: number) => {
      // rAF 가 켠 틱 직전 타임스탬프로 들어올 때가 있어 0 아래로는 안 내려가게 막는다
      const counter = Math.max(0, appTickOf(now) - startTick)
      if (counter >= ticks) {
        setTurn(STILL)
        return
      }
      setTurn({ fromCursor: from, direction, counter })
      handle = requestAnimationFrame(tick)
    }
    handle = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(handle)
  }, [cursor, count, ticks])

  return turn
}
