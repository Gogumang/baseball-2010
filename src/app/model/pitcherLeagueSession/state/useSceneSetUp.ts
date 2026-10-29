import { useCallback, useEffect } from 'react'
import { forgetRepeatableEvents } from '@/entities/story/model/storyScene'
import { withNariSceneSetupOutings } from '@/entities/career/model/playerCareer'
import { useOnRenderChange } from '@/shared/lib/renderMachine/useOnRenderChange'
import { type PitcherAtoms, type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom, lastSeenGamesAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import {
  cursorAtom,
  fileEventsAtom,
  freshSceneAtom,
  sceneSetUpCountAtom,
  shouldForgetRepeatableAtom,
} from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'

/**
 * **나리 장면 0x106 이 새로 선다** — 셋업 0xf684: fb1c `0x8ce94` → `0xacf60`(반복 이벤트 본 표시 지움 · 커서 0) · fb7a
 * mgr+0x304 = 1. 투수편 화면에 들어설 때(메인 메뉴에서 · 이어하기)와 경기 뒤 · 경기 나가기 뒤 · 마선수 대결 뒤에 선다.
 * (장면+0x288 은 `matchPreparedAtom` 이 따로 든다.)
 */
export function useSetUpPitcherScene(atoms: PitcherAtoms) {
  return useCallback(() => {
    atoms.set(cursorAtom, 0)
    atoms.set(freshSceneAtom, true)
    atoms.set(shouldForgetRepeatableAtom, true)
    atoms.set(sceneSetUpCountAtom, (count) => count + 1)
  }, [atoms])
}

/**
 * 셋업 0xf684 fb92~fba8 — 경기 수 == 2 면 외출 칸 +0x6a = 0. 경기 뒤 커리어 커밋 뒤 렌더에서 지운다 (`withNariSceneSetupOutings`).
 * B-84 고친 길은 앞 셋업 때(이 세션에서 마지막으로 본) 경기 수를 본다 — 2 로 막 오른 셋업만 지운다.
 */
export function useSceneSetUpOutings({ atoms }: PitcherScope): void {
  const sceneSetUpCount = usePitcherValue(atoms, sceneSetUpCountAtom)
  const gamesPlayed = usePitcherValue(atoms, careerAtom)?.gamesPlayed
  useEffect(() => {
    if (sceneSetUpCount === 0) return
    const previousGames = atoms.get(lastSeenGamesAtom)
    atoms.set(careerAtom, (current) => (current === null ? current : withNariSceneSetupOutings(current, previousGames)))
  }, [atoms, sceneSetUpCount])
  useEffect(() => {
    atoms.set(lastSeenGamesAtom, gamesPlayed ?? null)
  }, [atoms, gamesPlayed])
}

/** 메인 메뉴 따위에서 투수편 화면으로 들어선다 — 장면 0x106 이 새로 선다(떠나면 헐린다). 들어선 그 그림에서 칸을 고친다 */
export function useScreenEntrySetUp({ atoms, isOnScreen }: PitcherScope): void {
  useOnRenderChange(isOnScreen, (isEntering) => {
    if (!isEntering) return
    atoms.set(cursorAtom, 0)
    atoms.set(freshSceneAtom, true)
    atoms.set(shouldForgetRepeatableAtom, true)
  })
}

/**
 * 셋업 0xf684 의 0xacf60 — 반복 이벤트 본 표시를 이벤트 본문이 온 뒤 커밋에서 지운다. 105 진입 훑기(굴림)가 이 고침 다음 커밋에
 * 도는 옛 차례 그대로다.
 */
export function useForgetRepeatable({ atoms }: PitcherScope): void {
  const fileEvents = usePitcherValue(atoms, fileEventsAtom)
  const shouldForgetRepeatable = usePitcherValue(atoms, shouldForgetRepeatableAtom)
  useEffect(() => {
    if (!shouldForgetRepeatable || fileEvents === null) return
    atoms.set(shouldForgetRepeatableAtom, false)
    atoms.set(careerAtom, (current) => (current === null ? current : forgetRepeatableEvents(current, fileEvents)))
  }, [atoms, fileEvents, shouldForgetRepeatable])
}
