import { enterSceneConfirm } from '@/features/play-game/model/sceneConfirm'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import type { MissionAtoms } from '@/app/model/missionSession/atoms/missionScope'
import { newAtBatWaitAtom, sceneConfirmAtom } from '@/app/model/missionSession/atoms/sceneAtoms'
import { pitchSelectionEntryAtom } from '@/app/model/missionSession/atoms/pitchSelectionAtoms'
import { stealInputAtom, stealingFromAtom } from '@/app/model/missionSession/atoms/fieldAtoms'
import { freshAtBatWaits } from '@/app/model/missionSession/scene/announcedWait'

/** 새 타석 0xd → 0xe — OK 를 기다린 뒤 0xf 로 간다 */
export function enterNewAtBatConfirm(atoms: MissionAtoms): void {
  const wait = enterSceneConfirm()
  // 0x16 을 안 거친 0xd — 메시지 0xbc1 의 타석 등장음을 단다(`sceneConfirm` 을 내놓을 때 그때의 판으로 고른다)
  freshAtBatWaits.add(wait)
  atoms.set(newAtBatWaitAtom, wait)
  atoms.set(sceneConfirmAtom, wait)
}

/** 타석을 새로 세운다 — 0xd → 0xe 라 OK 를 기다린다 */
export function resetAtBatWithConfirm(atoms: MissionAtoms, runner: AtBatRunner, count?: { balls: number; strikes: number }): void {
  enterNewAtBatConfirm(atoms)
  runner.resetAtBat(count)
}

/** 0xf 진입 신호를 하나 올린다 — 진행이 다 먹인 뒤의 판을 봐야 해서 그린 뒤의 고리가 묻는다(`usePitchSelectionEntry`) */
export function signalPitchSelection(atoms: MissionAtoms, kind: 'new' | 'same', delayTicks = 0): void {
  atoms.set(pitchSelectionEntryAtom, (previous) => ({ serial: (previous?.serial ?? 0) + 1, kind, delayTicks }))
}

/** 이번 공에 출발한 도루 주자를 판 입력으로 거둔다 — 다음 공 전에 0xf 가 지우므로 같다 */
export function takeStealingFrom(atoms: MissionAtoms) {
  const taken = atoms.get(stealInputAtom)
  atoms.set(stealInputAtom, [])
  return taken
}

/** 표시 칸 st[0x15 + i] 를 지운다 — 0xf 진입 0x3d954 · 타구 판 시작 0x3d7b8(종류 1) */
export function clearStealDisplay(atoms: MissionAtoms): void {
  atoms.set(stealInputAtom, [])
  atoms.set(stealingFromAtom, (previous) => (previous.length === 0 ? previous : []))
}
