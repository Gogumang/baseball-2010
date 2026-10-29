import { useCallback } from 'react'
import { leagueSideOf } from '@/entities/league/model/league'
import { seasonOpponentOf, SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { staminaOptionsOf, withOwnRecordRotation } from '@/app/model/seasonSession/stamina/stamina'
import { type SeasonScope, useSeasonValue } from '@/app/model/seasonSession/atoms/seasonScope'
import { saveAtom } from '@/app/model/seasonSession/atoms/saveAtoms'
import { gameKindAtom, gameOptionsAtom, ownRotationShiftAtom, resumeGameAtom, sceneAtom } from '@/app/model/seasonSession/atoms/sceneAtoms'
import { useSeasonGameSetup } from '@/app/model/seasonSession/state/useSeasonGameSetup'
import { useGameOptionsFor } from '@/app/model/seasonSession/nextGame/useGameOptionsFor'
import { useNextGameSteps } from '@/app/model/seasonSession/nextGame/useNextGameSteps'

/** 다음 경기 열기 — 다음경기 화면(0xd8) · 화면을 건너뛰는 시험용 길 */
export function useNextGameStart(scope: SeasonScope) {
  const { atoms } = scope
  const save = useSeasonValue(atoms, saveAtom)
  const optionsFor = useGameOptionsFor(scope)
  const { withGameSettings } = useSeasonGameSetup(scope)
  const { clearGameRecord, nextGameEntered } = useNextGameSteps(scope)
  /**
   * 경기 전 화면(0xd7·0xdd)을 **건너뛰고** 곧장 정규 경기로 — 마선수 없이 저장된 설정으로 친다.
   * 원본에는 이런 길이 없다. 화면은 쓰지 않고 테스트·디버그용으로만 남긴다.
   */
  const playNextGame = useCallback(() => {
    if (save === null) return
    // 정규시즌 가지 — 0xb7844 가 일정표 0xd89cb 로 정한다 (리그 날짜 L+0x32 = SR+0xb2)
    const options = optionsFor(seasonOpponentOf(save.state.record), leagueSideOf(save.state.record.games, save.state.record.teamId))
    if (options === null) return
    clearGameRecord(save, options.opponentTeamId)
    atoms.set(gameKindAtom, '정규')
    atoms.set(resumeGameAtom, null)
    const prepared = withOwnRecordRotation({ ...options, ...staminaOptionsOf(save, options.opponentTeamId) })
    atoms.set(ownRotationShiftAtom, prepared.shift)
    atoms.set(gameOptionsAtom, withGameSettings(prepared.options))
    atoms.set(sceneAtom, SEASON_SCENE_STATE.경기직전)
  }, [atoms, clearGameRecord, optionsFor, save, withGameSettings])
  const openNextGame = useCallback(() => {
    if (save === null) return
    nextGameEntered(save, true)
  }, [nextGameEntered, save])
  return { playNextGame, openNextGame }
}
