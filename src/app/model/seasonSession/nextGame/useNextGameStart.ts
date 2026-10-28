import { useCallback } from 'react'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow'
import { LEAGUE_SIDE_HOME, leagueSideOf } from '@/entities/league/model/league'
import { PLAYER_SIDE_LAST_BAT, PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import { illnessPenaltyFieldOf } from '@/entities/season-mode/model/seasonEventFlow'
import { seasonEntryOrderOf } from '@/entities/season-mode/model/seasonEntry'
import { clearSeasonGameRecord } from '@/entities/season-mode/model/seasonReputation'
import { seasonOpponentOf, SEASON_SCENE_STATE, SEASON_PHASE } from '@/entities/season-mode/model/seasonStateMachine'
import { SQUAD_PURPOSE, PRE_GAME_ACES_START } from '@/entities/season-mode/model/preGameFlow'
import { SEASON_GAME_MODE } from '@/app/model/seasonSession/constants/seasonConstants'
import { seasonLeaguePitcherOrderOf, seasonLeagueStarterSlotOf } from '@/app/model/seasonSession/game/pitcherOrder'
import { withSceneSetupIncome } from '@/app/model/seasonSession/game/sceneSetup'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'
import { staminaOptionsOf, withOwnRecordRotation } from '@/app/model/seasonSession/stamina/stamina'
import type { PendingSeasonGame } from '@/app/model/seasonSession/types/session'
import type { SeasonShopActionsContext } from '@/app/model/seasonSession/shop/useSeasonShopActions'

/** `useSeasonSession` 몸통 문장 80~85 을 그대로 옮겼다 (r346) — 부르는 차례 · 훅 차례는 `useSeasonSession` 그대로 */
export function useNextGameStart(ctx: SeasonShopActionsContext) {
  const { save, seasonMatchSettingsRef, aceLevels, entryOrderOf, commit, setGameKind, setResumeGame, setOwnRotationShift, setGameOptions } = ctx
  const { withGameSettings, setScene, latestSave, setSave, setNextGameFromMenu, setPendingGame, setSquadPurpose, setPreGameAces } = ctx
  const { setIsMatchSettingsOpen } = ctx
  /**
   * 커리어·팀 상태에서 팀 경기 옵션을 만든다 (세 종류가 같은 화면을 쓴다).
   *
   * `side` 는 원본 `0xb7844(리그, 팀)` 가 돌려주는 값 그대로다 — **1 = 홈(후공)**.
   * 세 갈래(정규·포스트시즌·국가대항전)가 서로 다른 가지를 타므로 부르는 쪽이 골라 넣는다.
   * 경기 준비 `0x6650` 이 그 값을 그대로 `경기[0x28 + side] = 팀번호` 로 꽂는다.
   */
  const optionsFor = useCallback(
    (opponent: number, side: number): TeamGameOptions | null => {
      if (save === null) return null
      const { record } = save.state
      return {
        mode: SEASON_GAME_MODE,
        ourTeamId: record.teamId,
        // [시즌+1] — 질병·보직·사기 보정(0xb5804)이 선수 팀 번호와 견주는 값. 국가대항전은
        // ourTeamId 만 대한민국(10)으로 바뀌고 이 값은 시즌 팀 그대로라 보정이 아무 팀에도 안 붙는다
        seasonTeamId: record.teamId,
        opponentTeamId: opponent,
        playerSide: side === LEAGUE_SIDE_HOME ? PLAYER_SIDE_LAST_BAT : PLAYER_SIDE_FIRST_BAT,
        // 경기진행 설정 시즌 칸 — 0xdd 의 '0' 창이 고친 값. 한 번도 안 고쳤으면 원본 0 초기값(찬스 · 공격 득점권)
        settings: seasonMatchSettingsRef.current,
        // 코치는 SR+0x185 다 — 채용 화면(0xd7)이 채운 칸을 그대로 넘긴다 (−1 = 없음)
        // 질병 −30% 는 질병 종류 SR+5 가 아니라 **SR+6 > 0** 을 본다 (0xb5824 `ldrsb [SR,#6]`) — `illnessPenaltyFieldOf`
        season: { illness: illnessPenaltyFieldOf(record), morale: save.state.teamMorale, coach: record.coach },
        // 선발 = 리그 투수 레코드 차례의 0번 (`seasonLeagueStarterSlotOf` — g = SR+0xb2 ≠ 0 이면 0x6548 이 한 칸 돌린 뒤).
        // 엔트리 편집·경기정보는 내 팀 명단을 `rotationSlotOf(dayCounter)` 칸 돈 모양으로 보인다. 리그 차례는 0xb5ca8 만
        // 움직여 늘 투수 0~3 을 k 칸 돌린 모양이라 선발 칸 k 를 날짜 칸에 넣으면 그 모양이 원본 레코드와 같다 —
        // 포스트시즌(`postseasonStarterSlotOf`)과 같은 방식이다. 상대 팀은 레코드 차례 전체(`opponentPitcherOrder` — 0번 선발 · 나머지 벤치 차례)를 넘긴다. 날짜 칸
        // (`opponentDayCounter`)은 경기정보·CPU 엔트리 화면이 보는 같은 차례의 0번이다. 내 팀 벤치 차례는 경기를
        // 세울 때 `withOwnRecordRotation` 이 명단을 돌려 맞춘다
        dayCounter: seasonLeagueStarterSlotOf(save.league, record.teamId, record.games),
        opponentDayCounter: seasonLeagueStarterSlotOf(save.league, opponent, record.games),
        opponentPitcherOrder: seasonLeaguePitcherOrderOf(save.league, opponent, record.games),
        teamAbilities: save.state.teamAbilities,
        // 마선수 레벨 — 0xb6414 가 모드를 가리지 않고 전역 mgr[0x13a + i] 를 읽는다 (b9f896b·e2ee55a)
        aceLevels,
        // 시즌 저장의 팀 레코드 차례 그대로 — 경기용 팀 객체 0xb891c 는 첨자만 들고 선수는 0xb8680 으로 같은
        // 레코드(0x1f570)에서 읽으므로 엔트리 편집(0xe0)이 고친 차례가 곧 타순·벤치·투수 차례다 (c041959).
        // 경기정보 뒤에 편집이 끼면 `startPendingGame` 이 고친 명단으로 다시 싣는다
        ourEntryOrder: entryOrderOf(save.roster),
        // 상대 팀도 시즌 저장의 그 팀 레코드로 선다 (0xb891c → 0xb8680 → 0x1f570). 트레이드로 바뀐 팀만 저장에 있고
        // 나머지는 붙박이 표라 넘기지 않는다(예전 길 그대로)
        ...(save.cpuRosters?.[opponent] === undefined ? {} : { opponentEntryOrder: seasonEntryOrderOf(save.cpuRosters[opponent]) }),
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [aceLevels, entryOrderOf, save],
  )
  /**
   * 평판 기록 16칸(SR+0x1a0..0x1af)을 0 으로 — 원본 `0xa3424` = `memset(SR+0x1a0, 0, 16)`.
   *
   * **경기가 끝날 때가 아니라 시작할 때 지운다.** 부르는 곳은 경기 직전 경기정보 화면
   * (시즌 상태 0xdd)의 "경기 시작" 키 `0x83cc` **한 곳뿐**이고, 거기서 곧장 경기 장면으로
   * 넘어간다 (0x84ac `SR = [this+0xa0]` → `ldr r3,[0x85c8] = 0xa3425` → 0xa3424).
   * 웹판은 0xdd 의 확인(`startPendingGame`)과, 화면을 건너뛰는 `playNextGame` 이 이 자리를 맡는다.
   * 근거: `docs/re/S4-season-reputation.md` 2a·7절, `docs/re/R13-season-leftovers.md` 4절.
   */
  const clearGameRecord = useCallback(
    (current: SeasonSave, opponentTeamId: number) => {
      // 0xdd OK 의 0xa3424 뒤 곧장 경기 장면 셋업 — 정규시즌이면 관중·수입 0xa34b8 이 돈다 (`withSceneSetupIncome`)
      commit(
        withSceneSetupIncome(
          {
            ...current,
            state: {
              ...current.state,
              record: { ...current.state.record, gameRecord: clearSeasonGameRecord() },
            },
          },
          opponentTeamId,
        ),
      )
    },
    [commit],
  )
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
    setGameKind('정규')
    setResumeGame(null)
    const prepared = withOwnRecordRotation({ ...options, ...staminaOptionsOf(save, options.opponentTeamId) })
    setOwnRotationShift(prepared.shift)
    setGameOptions(withGameSettings(prepared.options))
    setScene(SEASON_SCENE_STATE.경기직전)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  }, [clearGameRecord, optionsFor, save, withGameSettings])
  /**
   * 다음경기 화면 0xd8 에 들어간다 — 들어옴 `0x4cb8`:
   * ```
   * 4cc2  SR+0x50(phase) = 4
   * 4cc8  이전 상태 ≠ 0xd7 이면 0x1fded(app) · 0x22755(app, 1)   ; 저장
   * 4ce0  [this+0x90] vtable+0x14(0, 0)                          ; 1×1 격자 커서를 (0,0) 에 — 보이는 일 없음 (NextGameScreen 주석)
   * ```
   * phase 4 가 저장에 남으므로 이 화면에서 끄고 다시 들어오면 **관리 메뉴가 아니라 0xd8** 로 온다
   * (진입 분기 0xcb 는 짝수 경기라도 phase ∈ {1,3} 일 때만 관리 메뉴다).
   */
  const nextGameEntered = useCallback(
    (current: SeasonSave, fromMenu: boolean, fromSquad = false) => {
      const entered: SeasonSave = {
        ...current,
        state: { ...current.state, record: { ...current.state.record, phase: SEASON_PHASE.다음경기 } },
      }
      // 4cc8 — 이전 상태가 0xd7(경기 전 마선수 고르기 CLR)이면 phase 4 는 메모리에만 쓰고 저장하지 않는다
      if (fromSquad) {
        // eslint-disable-next-line react-hooks/immutability -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
        latestSave.current = entered
        setSave(entered)
      } else {
        commit(entered)
      }
      setNextGameFromMenu(fromMenu)
      setScene(SEASON_SCENE_STATE.다음경기)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [commit],
  )
  const openNextGame = useCallback(() => {
    if (save === null) return
    nextGameEntered(save, true)
  }, [nextGameEntered, save])
  /**
   * 0xd7 경기 전 마선수 고르기로 (this+0x11c = 1). 들어옴 0x5268 이 메뉴+0xd0 = 1 이라 늘 마투수부터다.
   */
  const enterPreGameSquad = useCallback((pending: PendingSeasonGame) => {
    setPendingGame(pending)
    setSquadPurpose(SQUAD_PURPOSE.경기전)
    setPreGameAces(PRE_GAME_ACES_START)
    setIsMatchSettingsOpen(false)
    setScene(SEASON_SCENE_STATE.선수단)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  }, [])
  return { optionsFor, clearGameRecord, playNextGame, nextGameEntered, openNextGame, enterPreGameSquad }
}

/** `useNextGameStart` 까지 선 값 */
export type NextGameStartContext = SeasonShopActionsContext & ReturnType<typeof useNextGameStart>
