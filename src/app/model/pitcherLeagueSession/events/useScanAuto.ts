import { useCallback } from 'react'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { scanPitcherEventFrom } from '@/entities/pitcher-career/model/pitcherStoryScene'
import { isAutoScanHeldByAceMatch } from '@/app/model/aceMatchScanGuard'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { PitcherAtoms } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { cursorAtom, freshSceneAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { portsMirrorAtom } from '@/app/model/pitcherLeagueSession/atoms/portsAtoms'

/**
 * 자동 발동 한 번 — 0x8be80 → 0xadc70 (커서에서 이어 훑기). 끝까지 없으면 커서가 0 으로 되감기고 그 호출은 "없음" 이다.
 * 훑기는 상태가 바뀐 틀에만 돌아(0x1cdec 1ce02) 다음 틀에 처음부터 다시 훑는 일은 없다 — 다음 진입이 0 부터 본다(타자편과 같다).
 * 105 · 112 의 자동 발동 둘만 부른다 — 대결 대기(어느 편이든)가 서 있으면 커서를 안 건드리고 건너뛴다(1cfe4~1d008, B-124 원본 길).
 */
export function useScanAuto(atoms: PitcherAtoms) {
  return useCallback(
    (current: PitcherCareer, events: readonly OriginalEvent[], trigger: number, rolling: RandomPort | undefined) => {
      if (isAutoScanHeldByAceMatch(atoms.get(portsMirrorAtom).current.aceMatchHold)) return null
      const scan = scanPitcherEventFrom(current, events, trigger, atoms.get(cursorAtom), rolling, atoms.get(freshSceneAtom))
      atoms.set(cursorAtom, scan.cursor)
      return scan.event
    },
    [atoms],
  )
}
