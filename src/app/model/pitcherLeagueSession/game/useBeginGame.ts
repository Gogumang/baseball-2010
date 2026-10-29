import { useCallback } from 'react'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { resetLiveGameState } from '@/shared/lib/liveGameState/liveGameState'
import { type PitcherScope, usePitcherValue } from '@/app/model/pitcherLeagueSession/atoms/pitcherScope'
import { careerAtom } from '@/app/model/pitcherLeagueSession/atoms/careerAtoms'
import { sceneAtom } from '@/app/model/pitcherLeagueSession/atoms/sceneAtoms'
import { gameOptionsAtom } from '@/app/model/pitcherLeagueSession/atoms/gameAtoms'
import { recordGameOptionsOf } from '@/app/model/pitcherLeagueSession/game/gameOptions'

/** 리그 경기 옵션을 세우는 콜백 — 게이지 · 송구 설정과 마선수 레벨이 바뀔 때만 새로 선다 */
export function useRecordGameOptionsOf({ aceLevels, gaugeSettingOn, throwModeManual }: PitcherScope) {
  return useCallback(
    (current: PitcherCareer) => recordGameOptionsOf(current, { gaugeSettingOn, throwModeManual }, aceLevels),
    [aceLevels, gaugeSettingOn, throwModeManual],
  )
}

/** 리그 경기를 세운다 — 경기 장면 셋업 0x39fdc 모드 3·4 갈래(0x3a200) */
export function useBeginGame(scope: PitcherScope) {
  const { atoms } = scope
  const career = usePitcherValue(atoms, careerAtom)
  const gameOptionsOf = useRecordGameOptionsOf(scope)
  return useCallback(
    (from?: PitcherCareer) => {
      const current = from ?? career
      if (current === null) return
      // 0xb6814(전역 상태): +0x6b = 0
      resetLiveGameState()
      atoms.set(gameOptionsAtom, gameOptionsOf(current))
      atoms.set(sceneAtom, '경기')
    },
    [atoms, career, gameOptionsOf],
  )
}
