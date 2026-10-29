import { useEffect } from 'react'
import { setGameSceneTickTimeout } from '@/shared/lib/commonWindow/commonWindow'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import { isPitcherSideOf, type MissionScope, useMissionValue } from '@/app/model/missionSession/atoms/missionScope'
import { pitcherAceMatchMissionAtom } from '@/app/model/missionSession/atoms/runAtoms'
import {
  armedPitchSelectionAtom,
  handledPitchSelectionAtom,
  pitchSelectionDueSerialAtom,
  pitchSelectionEntryAtom,
  pitchSelectionSceneMirrorAtom,
  type PitchSelectionEntry,
} from '@/app/model/missionSession/atoms/pitchSelectionAtoms'
import { useAskPitchSelection } from '@/app/model/missionSession/scene/useAskPitchSelection'

/** 투수 미션 — 0x12 를 다 선 0xf 진입 틀까지 장면 틱으로 셀 신호인가 (`delayTicks` 가 남았고 아직 그 틀이 안 왔다) */
const waitsForEntryTick = (isPitcherSide: boolean, entry: PitchSelectionEntry, dueSerial: number) =>
  isPitcherSide && entry.delayTicks > 0 && dueSerial !== entry.serial

/** 0xf 진입 고리가 읽는 이 그림의 값을 상자에 적는다 — 고리는 공 · 마감 · 결과 띠가 바뀔 때만 돈다 */
export function usePitchSelectionSceneMirror(scope: MissionScope): void {
  const { atoms, screen } = scope
  const pitcherAceMatchMission = useMissionValue(atoms, pitcherAceMatchMissionAtom)
  const askPitchSelection = useAskPitchSelection(scope)
  useMirrorRef(useMissionValue(atoms, pitchSelectionSceneMirrorAtom), {
    isPitcherSide: isPitcherSideOf(screen.kind, pitcherAceMatchMission),
    askPitchSelection,
  })
}

/** 같은 타석 다음 공의 0xf 진입 — 진행이 다 먹인 뒤의 판을 봐야 해서 그린 뒤에 돈다 */
export function usePitchSelectionEntry(scope: MissionScope): void {
  const { atoms, runner } = scope
  const pitchSelectionEntry = useMissionValue(atoms, pitchSelectionEntryAtom)
  const pitchSelectionDueSerial = useMissionValue(atoms, pitchSelectionDueSerialAtom)
  useEffect(() => {
    const entry = pitchSelectionEntry
    if (entry === null || entry.serial === atoms.get(handledPitchSelectionAtom)) return
    // 타자 미션은 결과 띠가 걷혀야(0x12 가 끝나야) 0xf 다
    const { isPitcherSide, askPitchSelection: ask } = atoms.get(pitchSelectionSceneMirrorAtom).current
    if (!isPitcherSide && runner.bannerText !== '') return
    // 투수 미션 — 0x12 를 다 선 0xf 진입 틀까지 장면 틱으로 센다(공용 창이 서면 함께 선다, 52cc6)
    if (waitsForEntryTick(isPitcherSide, entry, pitchSelectionDueSerial)) {
      if (atoms.get(armedPitchSelectionAtom) === entry.serial) return
      atoms.set(armedPitchSelectionAtom, entry.serial)
      setGameSceneTickTimeout(() => atoms.set(pitchSelectionDueSerialAtom, entry.serial), entry.delayTicks)
      return
    }
    atoms.set(handledPitchSelectionAtom, entry.serial)
    ask(entry.kind)
  }, [atoms, pitchSelectionEntry, pitchSelectionDueSerial, runner.bannerText])
}
