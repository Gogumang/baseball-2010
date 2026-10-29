import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { pushSceneKey } from '@/shared/lib/sceneKeyLatch/sceneKeyLatch'
import { movedListCursor } from '@/pages/team-game/lib/substitutionWindow'
import type { SubstitutionRow } from '@/pages/team-game/lib/substitutionWindow'

/** 키 0x495fc 의 갈래 — '2'·↑ / '8'·↓ 목록 · OK·'5' 확정 · '0' 상세 창 */
type ListKey = '위' | '아래' | '확정' | '상세'

const LIST_KEYS: Readonly<Record<string, ListKey>> = { ArrowUp: '위', 2: '위', ArrowDown: '아래', 8: '아래', Enter: '확정', 5: '확정', 0: '상세' }

/**
 * 교체 창의 목록 커서 · 상세 창 칸과 키 0x495fc. 키 처리기는 처음 그림에 한 번 걸고 `stateRef` · `latest` 로 지금 값을 읽는다
 * (상태 0xb 의 키 함수는 장면 키 자리 52da2 에서 받은 다음 틀에 돈다 — 장면 키 칸 `pushSceneKey`)
 */
export function useSubstitutionList(tick: number, bench: readonly SubstitutionRow[], onConfirm: (index: number) => void) {
  const [list, setList] = useState({ cursor: 0, top: 0 })
  /** [skin+0x424] — 연 그림 수 (창 걸음 · 도형 자람). null 이면 닫힘 */
  const [detailOpenedAt, setDetailOpenedAt] = useState<number | null>(null)
  /** 도형을 다시 만든 그림 (+0x1e3 = 0 — '0' · 위아래) */
  const [radarRestartAt, setRadarRestartAt] = useState(0)
  const stateRef = useRef({ list, detailOpenedAt, tick })
  const latest = useRef({ bench, onConfirm })
  useLayoutEffect(() => {
    stateRef.current = { list, detailOpenedAt, tick }
    latest.current = { bench, onConfirm }
  })

  const move = (dy: number) => {
    setList((value) => movedListCursor(value.cursor, value.top, latest.current.bench.length, dy))
    // 0x4962c — 상세 창이 떠 있으면 [[skin+0xd8]+0x1e3] = 0 (도형을 다시 만든다)
    if (stateRef.current.detailOpenedAt !== null) setRadarRestartAt(stateRef.current.tick)
  }
  const confirm = () => {
    const row = latest.current.bench[stateRef.current.list.cursor]
    setDetailOpenedAt(null)
    if (row !== undefined) latest.current.onConfirm(row.index)
  }
  const toggleDetail = () => {
    const opening = stateRef.current.detailOpenedAt === null
    setDetailOpenedAt(opening ? stateRef.current.tick : null)
    if (opening) setRadarRestartAt(stateRef.current.tick)
  }

  useEffect(() => {
    const runKey: Readonly<Record<ListKey, () => void>> = {
      위: () => move(-1),
      아래: () => move(1),
      확정: () => confirm(),
      상세: () => toggleDetail(),
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      const key = LIST_KEYS[event.key]
      if (key === undefined) return
      event.preventDefault()
      pushSceneKey(runKey[key])
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
    // 키 처리는 stateRef · latest 로 지금 값을 읽는다
  }, [])

  return { list, detailOpenedAt, radarRestartAt, move, confirm, toggleDetail }
}
