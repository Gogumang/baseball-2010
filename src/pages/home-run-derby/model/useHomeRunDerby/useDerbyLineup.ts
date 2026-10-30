import { useCallback, useLayoutEffect, useRef, useState } from 'react'
import { confirmDerbyNextBatter, createDerbyLineup, reserveDerbyNextBatter } from '@/entities/home-run-derby/model/derbyLineup'
import type { DerbyLineup } from '@/entities/home-run-derby/model/derbyLineup'

/**
 * **공격 팀(팀 0) 타순** — 셈(예약 포함)은 ref, 화면 칸은 0xd 에서 타순이 넘어갈 때 맞춘다.
 * 볼넷 · 사구가 다음 타순을 예약하고(`reserveNextBatter`) 다음 0xd 진입이 확정한다(`confirmNextBatter`).
 */
export function useDerbyLineup(myTeamId: number, modeBatterSlot: number) {
  const myTeamIdRef = useRef(myTeamId)
  const modeBatterSlotRef = useRef(modeBatterSlot)
  useLayoutEffect(() => {
    myTeamIdRef.current = myTeamId
    modeBatterSlotRef.current = modeBatterSlot
  })
  const [lineup, setLineup] = useState<DerbyLineup>(() => createDerbyLineup(myTeamId, modeBatterSlot))
  const lineupRef = useRef<DerbyLineup>(lineup)

  /** 경기 초기화 0x39fdc 모드 7 — 팀 0 을 새로 세워 타순을 모드 타자 칸 k 로 */
  const startLineup = useCallback(() => {
    const fresh = createDerbyLineup(myTeamIdRef.current, modeBatterSlotRef.current)
    lineupRef.current = fresh
    setLineup(fresh)
  }, [])

  /** 48ddc 0xaebe4(공격 팀, 0) — 볼넷 · 사구가 예약한 다음 타순(+0x291 · +0x293)을 0xd 진입에서 확정한다. 모드 7 도 되돌리지 않는다 */
  const confirmNextBatter = useCallback(() => {
    const confirmed = confirmDerbyNextBatter(lineupRef.current)
    if (confirmed === lineupRef.current) return
    lineupRef.current = confirmed
    setLineup(confirmed)
  }, [])

  /** 볼넷 v3 → 사구 v4 0x3e1b4 `0xaf020(공격 팀, 0)` — 다음 타순 예약. 확정은 다음 0xd 진입 */
  const reserveNextBatter = useCallback(() => {
    lineupRef.current = reserveDerbyNextBatter(lineupRef.current)
  }, [])

  return { lineup, myTeamIdRef, startLineup, confirmNextBatter, reserveNextBatter }
}
