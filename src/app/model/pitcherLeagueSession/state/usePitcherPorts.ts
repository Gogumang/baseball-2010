import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { memoryAceMatchPendingAtom, portsMirrorAtom } from '@/app/model/pitcherLeagueSession/atoms/portsAtoms'

/** 손잡이 상자를 그림마다 적는다 — 전역기록 +0x4f · 나간 대결 대기(안 넘기면 세션 메모리) · 두 편 대결 대기 */
export function usePitcherPorts({ atoms, nariGameSave, aceMatchPending, aceMatchHold }: PitcherScope): void {
  const memoryAceMatchPending = usePitcherValue(atoms, memoryAceMatchPendingAtom)
  useMirrorRef(usePitcherValue(atoms, portsMirrorAtom), { nariGameSave, aceMatchPending: aceMatchPending ?? memoryAceMatchPending, aceMatchHold })
}
