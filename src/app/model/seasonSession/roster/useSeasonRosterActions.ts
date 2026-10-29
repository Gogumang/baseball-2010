import { useCallback } from 'react'
import { startNewSeason, type SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { EMPTY_LEAGUE } from '@/entities/league/model/league'
import { EMPTY_LEAGUE_PLAYER_STATS } from '@/entities/league/model/leaguePlayerStats'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { type SeasonTeamRoster, removeHallOfFamerFromRoster, removeCareerPlayerFromRoster } from '@/entities/season-mode/model/playerRecruit'
import { recordAceSlotOf, rosterOf } from '@/app/model/seasonSession/roster/roster'
import { seasonGlobalCarryOf } from '@/app/model/seasonSession/save/globals'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'
import { fullCpuPitcherStaminas } from '@/app/model/seasonSession/stamina/stamina'
import type { SceneEntryEffectContext } from '@/app/model/seasonSession/scene/useSceneEntryEffect'

/** `useSeasonSession` 몸통 문장 69~74 을 그대로 옮겼다 (r346) — 부르는 차례 · 훅 차례는 `useSeasonSession` 그대로 */
export function useSeasonRosterActions(ctx: SceneEntryEffectContext) {
  const {
    save,
    carriedGlobalsRef,
    setCarriedGlobals,
    commit,
    newPlayerFlagRef,
    setScene,
    latestSaveRef,
    persistedSaveRef,
    setSave,
    store,
    globalsRef,
    setGameOptions,
  } = ctx
  const { setResumeGame, setPendingGame, setEntryEdit } = ctx
  const chooseTeam = useCallback(
    (teamId: number, name: string) => {
      // 새 시즌 0x57f4~0x5806: 전역기록 +0x42 = 1 · **+0x4e = 0** — 새 저장에는 경기 블록·표시 칸이 없다(= 0)
      const next: SeasonSave = {
        // 0xa33e4(SR, 0x1552d00+0x28) — 0xc8 에서 입력한 이름이 SR+0x17c 로
        state: startNewSeason(teamId, name),
        league: EMPTY_LEAGUE,
        roster: rosterOf(teamId),
        playerStats: EMPTY_LEAGUE_PLAYER_STATS,
        series: null,
        ranking: [],
        cup: null,
        cpuPitcherStaminas: fullCpuPitcherStaminas(teamId),
        // 경기진행 설정(+0x12c+1)과 창을 본 표시(+0x11e)는 전역 저장 칸이라 새 시즌이 넘겨받는다 — 시즌 초기화 뒤면
        // 남겨 둔 덩어리에서
        ...seasonGlobalCarryOf(save ?? carriedGlobalsRef.current),
      }
      commit(next)
      // 0xcc → 0xcb: 새 시즌 초기화에서 왔으니 새 선수 플래그가 선다 — 관리 메뉴 첫 폴링이 400 을 튼다
      newPlayerFlagRef.current = true
      setScene(SEASON_SCENE_STATE.관리메뉴)
    },
    [commit, save, carriedGlobalsRef, newPlayerFlagRef, setScene],
  )
  const updateRecord = useCallback(
    (record: SeasonRecord) => {
      if (save === null) return
      commit({ ...save, state: { ...save.state, record } })
    },
    [commit, save],
  )
  const updateRoster = useCallback(
    (roster: SeasonTeamRoster) => {
      if (save === null) return
      commit({ ...save, roster })
    },
    [commit, save],
  )
  const removeHallOfFamer = useCallback(
    (id: number, isPitcher: boolean) => {
      if (save === null) return
      const roster = removeHallOfFamerFromRoster(save.roster, id, isPitcher, recordAceSlotOf(save, isPitcher))
      if (roster !== save.roster) commit({ ...save, roster })
    },
    [commit, save],
  )
  const removeCareerPlayer = useCallback(
    (isPitcher: boolean) => {
      const current = latestSaveRef.current
      if (current === null) return
      const roster = removeCareerPlayerFromRoster(current.roster, isPitcher, recordAceSlotOf(current, isPitcher))
      if (roster !== current.roster) commit({ ...current, roster })
    },
    [commit, latestSaveRef],
  )
  /**
   * 0x224ec(mgr, 2) — 시즌 파일 지움(+0x42 = 0) · +0x4e = 0. 웹 시즌 저장 한 칸이 곧 그 파일이고 +0x4e 도 그 안에 있다.
   * 같은 함수의 나머지 칸(전역기록 G)은 웹에 짝이 없어 지울 것이 없다 — `entities/settings/model/modeReset.ts` 머리 주석:
   * +0x48/+0x49 · +0x54/+0x55 · +0xf8~+0x117 · +0x138 은 대전모드 8·9 칸(🌐), +8 은 시즌 파일 도장(0x22754 가 쓰고 0x213c0 이
   * 견준다). 경기진행 설정(+0x12c+1)·창 본 표시(+0x11e)는 이 함수가 안 건드리는 전역 칸이라 **남긴다** — 시즌 없는 덩어리에
   * 그 두 칸만 쓴다(`SeasonGlobalCarry`).
   */
  const resetSeason = useCallback(() => {
    const current = latestSaveRef.current
    const carry = seasonGlobalCarryOf(current ?? carriedGlobalsRef.current)
    carriedGlobalsRef.current = carry
    setCarriedGlobals(carry)
    latestSaveRef.current = null
    persistedSaveRef.current = null
    setSave(null)
    store.save({ ...carry, ...globalsRef.current })
    setGameOptions(null)
    setResumeGame(null)
    setPendingGame(null)
    setEntryEdit(null)
    setScene(SEASON_SCENE_STATE.팀고르기)
  }, [
    store,
    carriedGlobalsRef,
    globalsRef,
    latestSaveRef,
    persistedSaveRef,
    setCarriedGlobals,
    setEntryEdit,
    setGameOptions,
    setPendingGame,
    setResumeGame,
    setSave,
    setScene,
  ])
  return { chooseTeam, updateRecord, updateRoster, removeHallOfFamer, removeCareerPlayer, resetSeason }
}

/** `useSeasonRosterActions` 까지 선 값 */
export type SeasonRosterActionsContext = SceneEntryEffectContext & ReturnType<typeof useSeasonRosterActions>
