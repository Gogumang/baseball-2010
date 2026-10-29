import { useCallback } from 'react'
import { choosePreGameAce, cancelPreGameAce, matchInfoCancelScene } from '@/entities/season-mode/model/preGameFlow'
import { SEASON_SCENE_STATE, seasonOpponentOf } from '@/entities/season-mode/model/seasonStateMachine'
import { leagueSideOf } from '@/entities/league/model/league'
import { tableRosterOf } from '@/entities/season-mode/model/seasonEntry'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import { staminaOptionsOf, withOwnRecordRotation } from '@/app/model/seasonSession/stamina/stamina'
import { type SeasonScope, useSeasonValue } from '@/app/model/seasonSession/atoms/seasonScope'
import { globalMatchSettingsAtom, matchSettingsMirrorAtom, saveAtom } from '@/app/model/seasonSession/atoms/saveAtoms'
import { gameKindAtom, gameOptionsAtom, ownRotationShiftAtom, resumeGameAtom, sceneAtom } from '@/app/model/seasonSession/atoms/sceneAtoms'
import { isMatchSettingsOpenAtom, pendingGameAtom, preGameAcesAtom } from '@/app/model/seasonSession/atoms/nextGameAtoms'
import { useSeasonSaveWriters } from '@/app/model/seasonSession/state/useSeasonSaveWriters'
import { useSeasonGameSetup } from '@/app/model/seasonSession/state/useSeasonGameSetup'
import { useGameOptionsFor } from '@/app/model/seasonSession/nextGame/useGameOptionsFor'
import { useNextGameSteps } from '@/app/model/seasonSession/nextGame/useNextGameSteps'
import { useEnterMatchInfo } from '@/app/model/seasonSession/nextGame/useEnterMatchInfo'

/** 경기 전 선수단(0xd7) · 경기정보(0xdd) 키 */
export function useMatchInfoActions(scope: SeasonScope) {
  const { atoms, matchSettingsSeenSlot } = scope
  const save = useSeasonValue(atoms, saveAtom)
  const pendingGame = useSeasonValue(atoms, pendingGameAtom)
  const preGameAces = useSeasonValue(atoms, preGameAcesAtom)
  const matchSettings = useSeasonValue(atoms, matchSettingsMirrorAtom)
  const { writeGlobalField } = useSeasonSaveWriters(scope)
  const { withGameSettings, entryOrderOf } = useSeasonGameSetup(scope)
  const optionsFor = useGameOptionsFor(scope)
  const { clearGameRecord, nextGameEntered, enterPreGameSquad } = useNextGameSteps(scope)
  const enterMatchInfo = useEnterMatchInfo(scope)
  /** 확인 `0x48fc`: `SR+0xb4`(포스트시즌) ? 0xef : (this+0x11c = 1, 0xd7 선수단 → 0xdd → 경기) */
  const confirmNextGame = useCallback(() => {
    if (save === null) return
    if (save.state.record.inPostseason) return atoms.set(sceneAtom, SEASON_SCENE_STATE.시즌결산)
    // 정규시즌 가지 — 0xb7844 가 일정표 0xd89cb 로 정한다 (리그 날짜 L+0x32 = SR+0xb2)
    const options = optionsFor(seasonOpponentOf(save.state.record), leagueSideOf(save.state.record.games, save.state.record.teamId))
    if (options === null) return
    enterPreGameSquad({ kind: '정규', options })
  }, [atoms, enterPreGameSquad, optionsFor, save])
  /** 0xd7 OK (0xa734) — 잠긴 칸 팝업·레벨업 창은 화면(`AceSelectScreen`)이 한다 */
  const choosePreGameAceAction = useCallback(
    (cell: number) => {
      if (save === null || pendingGame === null) return
      const step = choosePreGameAce(preGameAces, cell)
      atoms.set(preGameAcesAtom, step.aces)
      if (step.kind === '경기정보') enterMatchInfo(save, pendingGame, step.aces)
    },
    [atoms, enterMatchInfo, pendingGame, preGameAces, save],
  )
  /**
   * 0xd7 CLR (0xa900). 마투수 단계에서 나가면 포스트시즌 0xef · 그 밖 0xd8 이다.
   * 0xd8 로 돌아가면 들어옴 0x4cb8 이 다시 돌지만 **이전 상태가 0xd7** 이라 저장하지 않고,
   * 그 화면의 취소(0x48ea, 이전 상태 == 0xc9 일 때만)도 먹지 않는다 — 원본 그대로.
   */
  const cancelPreGameAceAction = useCallback(() => {
    if (save === null) return
    const step = cancelPreGameAce(preGameAces, save.state.record.inPostseason)
    if (step.kind === '고르기') return atoms.set(preGameAcesAtom, step.aces)
    atoms.set(pendingGameAtom, null)
    if (step.scene === SEASON_SCENE_STATE.다음경기) return nextGameEntered(save, false, true)
    atoms.set(sceneAtom, step.scene)
  }, [atoms, nextGameEntered, preGameAces, save])
  /**
   * 0xdd OK (0x847e~0x8532): 저장 · 평판 16칸 지움(0xa3424) · 0xe1 → 경기 장면.
   * 정규·포스트시즌이면 0xd7 에서 고른 마선수가 내 팀에 들어간다(0x6548 66ae~670a, 국가대항전은 안 넣는다).
   */
  const startPendingGame = useCallback(() => {
    if (save === null || pendingGame === null) return
    const withAces = pendingGame.kind === '국가대항전' ? {} : { acePitcherId: preGameAces.pitcher, aceBatterId: preGameAces.batter }
    // 0xdd 에서 엔트리 편집(0xe0)을 다녀왔으면 명단이 바뀌었다 — 경기는 지금 저장 레코드 차례로 선다.
    // 국가대항전은 대표팀 슬롯(+0x918) 명단이다
    const isCup = pendingGame.kind === '국가대항전'
    const roster = isCup ? (save.cupRoster ?? tableRosterOf(pendingGame.options.ourTeamId)) : save.roster
    clearGameRecord(save, pendingGame.options.opponentTeamId)
    atoms.set(isMatchSettingsOpenAtom, false)
    atoms.set(gameKindAtom, pendingGame.kind)
    // 새 경기 — +0x4e = 1 과 첫 블록(0x84a0 · 0x1fdb0 칸 0xc · 0xd)은 경기 화면이 세운 첫 진행으로 `saveGameProgress` 가 쓴다
    atoms.set(resumeGameAtom, null)
    // 0x6548 이 돌린 저장 레코드 차례로 명단을 세운다 — 0번 선발 · 나머지 벤치 차례 (`withOwnRecordRotation`)
    const prepared = withOwnRecordRotation({
      ...pendingGame.options,
      settings: matchSettings.current,
      ourEntryOrder: entryOrderOf(roster),
      // 투수 스태미나 +0x2c — 시즌 내내 이어진 값으로 선다. 국가대항전은 두 팀 모두 10000(기본)이다
      ...(isCup ? {} : staminaOptionsOf(save, pendingGame.options.opponentTeamId)),
      ...withAces,
    })
    atoms.set(ownRotationShiftAtom, prepared.shift)
    atoms.set(gameOptionsAtom, withGameSettings(prepared.options))
    atoms.set(pendingGameAtom, null)
    atoms.set(sceneAtom, SEASON_SCENE_STATE.경기직전)
  }, [atoms, clearGameRecord, entryOrderOf, matchSettings, pendingGame, preGameAces, save, withGameSettings])
  /** 0xdd CLR (0x844e) — 국가대항전이면 0xf4(웹은 대회 화면), 아니면 0xd7 을 다시 들어온다(0x5268) */
  const cancelMatchInfo = useCallback(() => {
    if (pendingGame === null) return
    atoms.set(isMatchSettingsOpenAtom, false)
    const next = matchInfoCancelScene(pendingGame.kind === '국가대항전')
    if (next === SEASON_SCENE_STATE.선수단) return enterPreGameSquad(pendingGame)
    atoms.set(pendingGameAtom, null)
    atoms.set(sceneAtom, next)
  }, [atoms, enterPreGameSquad, pendingGame])
  /** 0xdd '0' (0x857a) — `0x5fef4(메뉴, 열림 뒤집기)` */
  const toggleMatchSettings = useCallback(() => atoms.set(isMatchSettingsOpenAtom, (open) => !open), [atoms])
  /**
   * 0xdd 설정 창 확인 — 전역 m = 1 칸을 되쓰고 0x1f1b9 로 **전역 저장만** 쓴다(시즌 파일은 안 쓴다 — 0xe0 에서 고친 명단은
   * 아직 메모리에만 있다, `pressEntryKeyAction`). 전역 칸 손잡이가 없으면(시험) 시즌 저장 칸에 적되 마지막으로 파일에 쓴 시즌
   * 위에 얹는다(`writeGlobalField`)
   */
  const applyMatchSettings = useCallback(
    (settings: MatchProgressSettings) => {
      atoms.set(isMatchSettingsOpenAtom, false)
      const slot = matchSettingsSeenSlot
      if (slot?.readSeasonSettings !== undefined && slot.writeSeasonSettings !== undefined) {
        slot.writeSeasonSettings(settings)
        atoms.set(globalMatchSettingsAtom, settings)
        return
      }
      if (atoms.get(saveAtom) === null) return
      writeGlobalField({ matchSettings: settings })
    },
    [atoms, matchSettingsSeenSlot, writeGlobalField],
  )
  return {
    confirmNextGame,
    choosePreGameAceAction,
    cancelPreGameAceAction,
    startPendingGame,
    cancelMatchInfo,
    toggleMatchSettings,
    applyMatchSettings,
  }
}
