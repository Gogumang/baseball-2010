import { useEffect } from 'react'
import type { OutingPresentation, OutingResult } from '@/entities/career/model/outing'
import { EVENT_TRIGGER } from '@/entities/story/model/storyScene'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { fileEventsAtom, sceneAtom, storyAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import {
  outingEntryCountAtom,
  outingPresentationAtom,
  outingResultAtom,
  scannedOutingEntryAtom,
} from '@/app/model/pitcherLeagueSession/atoms/uiAtoms'
import { useOpenStory } from '@/app/model/pitcherLeagueSession/events/useOpenStory'
import { useScanAuto } from '@/app/model/pitcherLeagueSession/events/useScanAuto'

/** 126 효과 팝업 · 연출이 없다 */
const isMapIdle = (result: OutingResult | null, presentation: OutingPresentation | null) => result === null && presentation === null

/**
 * **외출 지도(112)의 자동 발동** — 0x1cf9c 는 현재 상태가 112 일 때도 같은 훑기를 화면코드 112 로 돈다
 * (trigger 1: 10 "병원이…?" · 401 인기도 3000). 찾으면 `[다음 114, 뒤 112]` — 끝나면 지도로 돌아온다.
 * 훑기는 **상태가 112 로 바뀐 틀에만** 돈다(0x1cdec 1ce02 — 105 와 같다) — 웹은 112 진입(`enterOutingMap`: 105 → 112 · 지도
 * 이벤트 뒤 · 113 취소)마다 한 번이다. 빈 장소 이벤트(440~444) 뒤는 113 으로 돌아가(0x1c014 1c07c) 112 진입이 아니라 훑지 않는다(Q-22).
 * 머무는 동안 커리어가 바뀌어도 다시 훑지 않는다. 굴림 · 이벤트 열기는 그린 뒤(커밋 뒤) — 진입 틀 차례 그대로.
 */
export function useOutingScan({ atoms, random }: PitcherScope): void {
  const career = usePitcherValue(atoms, careerAtom)
  const scene = usePitcherValue(atoms, sceneAtom)
  const story = usePitcherValue(atoms, storyAtom)
  const fileEvents = usePitcherValue(atoms, fileEventsAtom)
  const outingResult = usePitcherValue(atoms, outingResultAtom)
  const outingPresentation = usePitcherValue(atoms, outingPresentationAtom)
  const outingEntryCount = usePitcherValue(atoms, outingEntryCountAtom)
  const openStory = useOpenStory(atoms)
  const scanAuto = useScanAuto(atoms)
  useEffect(() => {
    const isOnMap = scene === '외출' && story === null && isMapIdle(outingResult, outingPresentation)
    if (career === null || fileEvents === null || !isOnMap || atoms.get(scannedOutingEntryAtom) === outingEntryCount) return
    atoms.set(scannedOutingEntryAtom, outingEntryCount)
    const event = scanAuto(career, fileEvents, EVENT_TRIGGER.외출, random)
    if (event !== null) openStory({ eventId: event.id, context: '지도', viewed: [] })
  }, [atoms, career, fileEvents, openStory, outingEntryCount, outingPresentation, outingResult, random, scanAuto, scene, story])
}
