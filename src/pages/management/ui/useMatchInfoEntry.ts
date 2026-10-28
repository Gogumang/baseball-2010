import { useEffect, useRef, useState } from 'react'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { matchInfoEntryPhaseOf, matchInfoValueRowsAt, matchInfoValueRowsAtCall } from '@/pages/management/lib/matchInfoEntry'
import type { MatchInfoEntryPhase, MatchInfoValueRows } from '@/pages/management/lib/matchInfoEntry'

export interface MatchInfoEntryView {
  readonly phase: MatchInfoEntryPhase
  readonly valueRows: MatchInfoValueRows
  /** '*' 재굴림 중 — 0x5dcc0 이 값 칸을 안 그리고 1 을 돌려준다(0x5dcd2~0x5dce4) */
  readonly areValueCellsHidden: boolean
  /** 키 함수가 이번 그림이 남긴 [skin+0xe4] 를 보고 키를 받나 — 키 처리기가 누를 때 읽는다 */
  readonly isKeyReady: { readonly current: boolean }
}

/**
 * 경기정보(k 4) 들어올 때 연출 · 값 줄 펼침 · 키 막음 (`lib/matchInfoEntry`).
 * 재굴림(일반 22 의 '*')이 끝난 그림에서는 [skin+0xf4] 가 내려가 [skin+0xec] = 0 이 보이므로 펼침을 처음부터 다시 한다 —
 * 그 그림을 첫 번째로 센다(갱신 0x3128c 가 [skin+0xf4] = 0 으로 둔 틱의 그리기).
 */
export function useMatchInfoEntry(isEntryAnimated: boolean, isRespinning = false): MatchInfoEntryView {
  const draws = useUpdateCounter()
  const [respin, setRespin] = useState<{ readonly wasRespinning: boolean; readonly endedAt: number | null }>({
    wasRespinning: isRespinning,
    endedAt: null,
  })
  if (respin.wasRespinning !== isRespinning) setRespin({ wasRespinning: isRespinning, endedAt: isRespinning ? null : draws })
  const { endedAt } = respin
  const phase = matchInfoEntryPhaseOf(draws, isEntryAnimated)
  const valueRows = endedAt !== null ? matchInfoValueRowsAtCall(draws - endedAt + 1) : matchInfoValueRowsAt(draws, isEntryAnimated)
  // 재굴림 중에는 0x5dcc0 이 1 을 돌려준다 — 그동안 키를 버리는 것은 갱신 0x312ba 쪽이다(화면이 `isRespinning` 으로 따로 막는다)
  const keyReady = phase.kind === '본문' && (isRespinning || valueRows.isReady)
  const isKeyReady = useRef(keyReady)
  useEffect(() => {
    isKeyReady.current = keyReady
  }, [keyReady])
  return { phase, valueRows: isRespinning ? { ...valueRows, isReady: true } : valueRows, areValueCellsHidden: isRespinning, isKeyReady }
}
