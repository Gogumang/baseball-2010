import { useEffect, useMemo } from 'react'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import { PITCHER_YEAR_START_EVENT } from '@/entities/pitcher-career/model/pitcherStoryScene'
import { type PitcherAtoms, type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { fileEventsAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'

/** r_event 본문을 커리어가 생긴 뒤 한 번 불러온다 (`fileEventsAtom`) — 세션 훅 머리에서 한 번만 부른다 */
export function useStoryEventsLoad({ atoms }: PitcherScope): void {
  const career = usePitcherValue(atoms, careerAtom)
  const fileEvents = usePitcherValue(atoms, fileEventsAtom)
  useEffect(() => {
    if (career === null || fileEvents !== null) return
    let isActive = true
    void import('@/shared/config/original/events').then((module) => {
      if (isActive) atoms.set(fileEventsAtom, module.ORIGINAL_EVENTS)
    })
    return () => {
      isActive = false
    }
  }, [atoms, career, fileEvents])
}

/** 재생기에 넘기는 목록 — 파일 이벤트 뒤에 연초 115 내장 이벤트를 붙인다 (훑기·배정은 파일 것만 본다) */
export function useStoryEvents(atoms: PitcherAtoms): readonly OriginalEvent[] | null {
  const fileEvents = usePitcherValue(atoms, fileEventsAtom)
  return useMemo(() => (fileEvents === null ? null : [...fileEvents, PITCHER_YEAR_START_EVENT]), [fileEvents])
}
