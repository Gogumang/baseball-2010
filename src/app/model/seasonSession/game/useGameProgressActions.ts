import { useCallback } from 'react'
import type { TeamGameProgress, TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow'
import { setLiveGameInningIndex, setLiveGameSides, liveGameSidesOf } from '@/shared/lib/liveGameState/liveGameState'
import { lapPlayClock } from '@/entities/collection/model/playClock'
import { withBatterRecordNibbles, withPitcherRecordNibbles } from '@/features/play-team-game/model/teamGameRoster'
import { isBugFixed } from '@/shared/config/bugfixes'
import { SEASON_SCENE_STATE, type SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine'
import { SQUAD_PURPOSE } from '@/entities/season-mode/model/preGameFlow'
import { SEASON_STAT_MODE } from '@/app/model/seasonSession/constants/seasonConstants'
import { withSceneSetupIncome } from '@/app/model/seasonSession/game/sceneSetup'
import type { SeasonEventActionsContext } from '@/app/model/seasonSession/seasonEnd/useSeasonEventActions'

/** `useSeasonSession` 몸통 문장 131~137 을 그대로 옮겼다 (r346) — 부르는 차례 · 훅 차례는 `useSeasonSession` 그대로 */
export function useGameProgressActions(ctx: SeasonEventActionsContext) {
  const { latestSave, settledGame, recordStat, commit, gameKind, ownRotationShift, withGameSettings, aceLevels, entryOrderOf, setGameKind } = ctx
  const { setOwnRotationShift, setPendingGame, setEntryEdit, setIsMatchSettingsOpen, setGameOptions, setResumeGame, setScene } = ctx
  const { setSquadPurpose, setNotice } = ctx
  /**
   * 경기 화면의 이어하기 저장 (`TeamGameScreen.onHalfInningSave`) — 진행 한 판마다 +0x4e = 1 과 블록을 시즌 저장에 쓴다.
   * 첫 진행이 0xdd OK 몫(0x847e — 원본도 OK 가 두 팀·st 를 칸 0xc · 0xd 에 걸고 파일을 쓴 뒤 경기 장면으로 간다),
   * 이어하기 경기의 첫 진행은 장면 진입 0x3a426 몫, 그 뒤는 반 이닝 0x4f928(모드 2 → 칸 0xb · 0xc · 0xd → 0x22754) 몫이다.
   */
  const saveGameProgress = useCallback(
    (progress: TeamGameProgress) => {
      const current = latestSave.current
      // 정산 진입(0x4ea0c) 뒤에는 반 이닝 저장이 없다 — 늦게 온 effect 가 +0x4e 를 되세우지 않게
      if (current === null || settledGame.current !== null) return
      // 반 이닝 저장(0x4f928)은 이닝 넘김 0xb6b6c 뒤다 — 전역 경기 상태 +0x6b 가 지금 이닝이다. 경기 중 나가기(0x40140)는
      // 이 칸을 안 지우므로 나간 그 이닝이 남는다 (`liveGameState`). 이어하기 첫 진행은 블록에서 되복사한 st 의 이닝이다
      setLiveGameInningIndex(progress.game.inning - 1)
      setLiveGameSides(liveGameSidesOf(progress.options, progress.game))
      // 0x4f928 의 0x4fa9e `0x4e8b0` — 반 이닝 저장마다 지난 시간을 칸 3(시즌) 플레이 시간에
      recordStat?.({ kind: '플레이시간', mode: SEASON_STAT_MODE, elapsed: lapPlayClock() })
      commit({ ...current, isGameInProgress: true, gameSave: { progress, kind: gameKind, ownRotationShift } })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [commit, gameKind, ownRotationShift, recordStat],
  )
  /**
   * 0x327b8 모드 2 갈래 — `+0x42(시즌 저장 있음) && +0x4e` 면 곧장 경기. 원본은 장면 0x105 를 세우지 않고 0x104 로 가서
   * 0x3f584 모드 2 갈래가 칸 0xc · 0xd 를 팀·st 로 되복사하고 0x39fdc 모드 2 갈래(0x3a3c0)가 관중·수입 0xa34b8 을 다시 돌린 뒤
   * +0x4e = 1 · 저장, 시뮬 초기화 rand(0, 2) → 인트로 → 판(`resumeTeamGame`).
   * ⚠️ 원본 그대로 이어 세울 때마다 0xa34b8(관중 수·경기 수입을 소지금에 더함)이 한 번 더 돈다 — 수입이 겹친다
   *    (`withSceneSetupIncome`, 정규시즌만).
   * 마선수 레벨은 원본이 경기 중 전역 칸에서 그때그때 읽으므로 지금 값으로 바꿔 끼운다.
   */
  const resumeSavedGame = useCallback((): boolean => {
    const current = latestSave.current
    if (current === null || current.isGameInProgress !== true) return false
    // +0x4e 와 블록은 함께 선다 — 쓰는 곳(경기 중간 저장)이 둘을 같이 적고, 읽을 때(`normalizeSeasonSave`)는 블록을 못 가려 내면
    // +0x4e 도 내린다. 그래서 여기서 다시 가리던 웹 전용 안전망(못 읽으면 표시를 내림)은 앱 길에서 안 닿아 걷었다(Q-13, r325 계측)
    const block = current.gameSave ?? null
    if (block === null) return false
    const saved = block.progress
    // 이어하기도 지금 환경설정으로 선다 (일반모드 `GeneralModeResume` 와 같다 — 원본은 설정 칸을 경기 중에 읽는다)
    const options: TeamGameOptions = withGameSettings({ ...saved.options, ...(aceLevels === undefined ? {} : { aceLevels }) })
    // 옛 블록 이사 — 기록으로 선 영입 선수의 니블 · +0xb 가 없으면 같은 레코드(지금 시즌 명단의 기록 사본)에서 채운다
    const order = entryOrderOf(current.roster)
    const restored: TeamGameProgress = {
      ...saved,
      options,
      ourEntry: withBatterRecordNibbles(saved.ourEntry, order),
      ourPitcherEntry: withPitcherRecordNibbles(saved.ourPitcherEntry, order),
    }
    // 장면 0x104 셋업 0x39fdc 모드 2 갈래 — 정규시즌이면 관중·수입 0xa34b8 이 **다시** 돈다(원본 버그: 이어할 때마다
    // 수입이 소지금에 겹친다). 곧이어 +0x4e = 1 · 파일 쓰기(0x3a426 · 0x22755)
    // 고침(`bugfixes.json` B-07, 기본 켬): 이어하기는 수입을 다시 더하지 않는다 — 새 경기 0xdd OK 가 이미 더해 저장했다
    // (이어하기는 `isGameInProgress` 가 선 뒤라 그 판의 수입이 늘 들어 있다). 난수 없음
    const withIncome = isBugFixed('B-07') ? current : withSceneSetupIncome(current, saved.options.opponentTeamId)
    if (withIncome !== current) commit(withIncome)
    setGameKind(block.kind)
    setOwnRotationShift(block.ownRotationShift)
    setPendingGame(null)
    setEntryEdit(null)
    setIsMatchSettingsOpen(false)
    setGameOptions(options)
    setResumeGame(restored)
    setScene(SEASON_SCENE_STATE.경기직전)
    return true
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  }, [aceLevels, commit, entryOrderOf, withGameSettings])
  /** 경기 중 "나가기" — 장면만 내린다(+0x4e · 블록은 그대로). 다음 진입이 `resumeSavedGame` 으로 다시 세운다 */
  const leaveGame = useCallback(() => {
    setGameOptions(null)
    setResumeGame(null)
    setScene(SEASON_SCENE_STATE.관리메뉴)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  }, [])
  /**
   * `0xb512c` 를 열 팀에 — 0xdf 진입 0x5980(5988~599e) · 0xe5 진입 0x5cd0(5cd8~5cee)이 목록을 채우기 전에 부른다(U-105 r154).
   * 저장은 따로 안 쓴다(다음 저장이 레코드째 쓴다) — 웹은 세이브 칸을 바로 비운다
   */
  const clearRecordAces = useCallback(() => {
    const current = latestSave.current
    if (current === null || current.recordAces === undefined) return
    const { recordAces: _cleared, ...rest } = current
    commit(rest)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  }, [commit])
  const goto = useCallback(
    (next: SeasonSceneState) => {
      // 구단관리 칸 3 코치채용 → this+0x11c = 2, 0xd7 (키 0x4e40)
      if (next === SEASON_SCENE_STATE.선수단) setSquadPurpose(SQUAD_PURPOSE.코치채용)
      if (next === SEASON_SCENE_STATE.선수고르기) clearRecordAces()
      setScene(next)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [clearRecordAces],
  )
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  const clearNotice = useCallback(() => setNotice(''), [])
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  const quit = useCallback(() => setScene(SEASON_SCENE_STATE.팀고르기), [])
  return { saveGameProgress, resumeSavedGame, leaveGame, clearRecordAces, goto, clearNotice, quit }
}

/** `useGameProgressActions` 까지 선 값 */
export type GameProgressActionsContext = SeasonEventActionsContext & ReturnType<typeof useGameProgressActions>
