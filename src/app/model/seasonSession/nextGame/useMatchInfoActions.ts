import { useCallback } from 'react'
import { type PreGameAces, choosePreGameAce, cancelPreGameAce, matchInfoCancelScene } from '@/entities/season-mode/model/preGameFlow'
import { resetLiveGameState } from '@/shared/lib/liveGameState/liveGameState'
import { rollOpponentAces } from '@/features/play-team-game/model/teamGameFlow'
import { SEASON_SCENE_STATE, seasonOpponentOf } from '@/entities/season-mode/model/seasonStateMachine'
import { leagueSideOf } from '@/entities/league/model/league'
import { tableRosterOf } from '@/entities/season-mode/model/seasonEntry'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import { seasonMatchInfoStageOf } from '@/app/model/seasonSession/game/sceneSetup'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'
import { staminaOptionsOf, withOwnRecordRotation, withSeasonFirstDayStamina } from '@/app/model/seasonSession/stamina/stamina'
import type { PendingSeasonGame } from '@/app/model/seasonSession/types/session'
import type { NextGameStartContext } from '@/app/model/seasonSession/nextGame/useNextGameStart'

/** `useSeasonSession` 몸통 문장 86~93 을 그대로 옮겼다 (r346) — 부르는 차례 · 훅 차례는 `useSeasonSession` 그대로 */
export function useMatchInfoActions(ctx: NextGameStartContext) {
  const { setPendingGame, random, setMatchInfoStage, matchSettingsSeenSlot, commit, setIsMatchSettingsOpen, setScene, save, optionsFor } = ctx
  const { enterPreGameSquad, pendingGame, preGameAces, setPreGameAces, nextGameEntered, clearGameRecord, setGameKind, setResumeGame } = ctx
  const { seasonMatchSettingsRef, entryOrderOf, setOwnRotationShift, setGameOptions, withGameSettings, setGlobalMatchSettings, latestSave } = ctx
  const { writeGlobalField } = ctx
  /**
   * 0xdd 경기정보로 — 들어옴 0x6548 (이전 상태가 0xe0 이면 6556 에서 곧장 6850 으로 — 웹은 0xe0 에서 돌아올 때
   * 이 함수를 안 부른다):
   *   - 저장 +0x11e 가 0 이면 **경기진행 설정 창을 저절로 열고** 그 칸을 1 로 써서 저장한다 (6564~659c).
   *   - 국가대항전(SR+0x12c)이 아니면(66ae) 0xd7 에서 고른 마선수를 내 팀에 싣고(66da·66e6) 이어 **상대 팀 마선수를
   *     굴린다** — `v = 0x66968(rec+0xe)`(66ee) → `0xb88c8(상대, v)`(66f8) · `w = 0x66994(rec+0xd)`(6700) →
   *     `0xb8870(상대, w)`(670a). 이 둘(rand 2)이 0xdd 진입의 유일한 굴림이다. 웹은 굴린 값을 옵션 `opponentAces` 로
   *     싣고 경기정보·CPU 엔트리 화면이 같은 값을 본다. 다시 0xd7 → 0xdd 로 들어오면 다시 굴린다(원본 그대로).
   *   - 두 팀 명단 세우기(0xb891c)·로테이션(0xb8c80)은 웹에서는 경기를 세울 때(`startTeamGame`) 한다.
   *   - 6850: `SR+0xb2 == 0`(시즌 첫날)이면 열 팀 투수 전원 10000 (`withSeasonFirstDayStamina`, 모듈 머리 주석).
   *     포스트시즌도 SR+0xb2 = L+0x32 가 시리즈마다 0 부터라(0xb80a8 b811c · 0xb7724 b777a −1 · 0xb818c +1) 시리즈 첫 경기면
   *     이 고리를 돈다 — L+0x34 를 보지 않는다(6850~6860 직접 떴다). 국가대항전 첫날도 이 고리를
   *     돌지만 대회 중 0x1f9a9 는 상대국 슬롯을 돌려주므로 리그 팀은 안 바뀐다 — 웹은 건너뛴다.
   *
   * **투수 스태미나 (P1 3절 · 직접 떴다)** — 투수 레코드 +0x2c 는 경기용 칸이 아니라 **시즌 내내 이어지는 값**이다.
   *   - `0xb6190(팀)` = 그 팀 투수 전원(팀+0xc 명, 팀+0x14 배열, 0x30 간격) +0x2c = 10000 (b6192~b61aa, 확정).
   *   - 정규·포스트시즌: 첫날 6850 뒤로는 하루 끝 4f2bc 의 열 팀 `0xb617c`(+20%)만 회복한다 — 경기에서 깎인 값(0xaeb08)이
   *     다음 경기로 **이어진다**. 내 팀은 `roster.pitchers[i].stamina`, 다른 아홉 팀은 `cpuPitcherStaminas` 에 두고
   *     경기 옵션 `ourPitcherStaminas`·`opponentPitcherStaminas` 로 넘겨 요약으로 받는다 (`finishGame`).
   *   - 국가대항전: 대회 초기화 b7c88 과 하루 끝 0xb818c 대회 갈래가 **대한민국을 매일 10000** 으로 채우고,
   *     상대국은 매일 마스터에서 새로 복사된다(0x20648) — 웹 팀 경기 기본값(늘 10000)과 같아 넘기지 않는다.
   */
  const enterMatchInfo = useCallback(
    (current: SeasonSave, pending: PendingSeasonGame, aces: PreGameAces | null) => {
      // 0x6548 의 65ec~6626 — 0xb6814(전역 상태): +0x6b = 0 (`liveGameState`). 0xe0 에서 돌아온 길(6556 → 6850)은 안 지난다
      resetLiveGameState()
      setPendingGame(
        pending.kind === '국가대항전' || aces === null
          ? pending
          : { ...pending, options: { ...pending.options, opponentAces: rollOpponentAces(aces.pitcher, aces.batter, random) } },
      )
      // 67dc~6834 — 무대 new · 0x78664(무대, 홈 팀) · +0x80/+0x84 · 0x78688(무대, 홈 팀, 1) · 0x5fd04(스킨, 무대).
      // 홈은 측 1 팀 — 대회면 대표팀(10~13)이라 rand(0, 10) 하나(마선수 굴림 뒤), 정규 · 포스트시즌은 0~9 라 안 굴린다
      setMatchInfoStage(seasonMatchInfoStageOf(pending.options, random))
      // +0x11e — 일반모드 22 가 먼저 봤으면 전역 칸이 이미 1 이다
      const firstTime = current.matchSettingsSeen !== true && matchSettingsSeenSlot?.read() !== true
      if (firstTime) matchSettingsSeenSlot?.markSeen()
      // 6850 은 SR+0xb2 만 본다 — 포스트시즌도 시리즈 첫 경기(g = 0)면 열 팀을 채운다(`postseasonDayOf`)
      const firstDay = pending.kind !== '국가대항전' && current.state.record.games === 0
      if (firstTime || firstDay) {
        const seen = firstTime ? { ...current, matchSettingsSeen: true } : current
        commit(firstDay ? withSeasonFirstDayStamina(seen) : seen)
      }
      setIsMatchSettingsOpen(firstTime)
      setScene(SEASON_SCENE_STATE.경기정보)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [commit, random, matchSettingsSeenSlot],
  )
  /** 확인 `0x48fc`: `SR+0xb4`(포스트시즌) ? 0xef : (this+0x11c = 1, 0xd7 선수단 → 0xdd → 경기) */
  const confirmNextGame = useCallback(() => {
    if (save === null) return
    if (save.state.record.inPostseason) return setScene(SEASON_SCENE_STATE.시즌결산)
    // 정규시즌 가지 — 0xb7844 가 일정표 0xd89cb 로 정한다 (리그 날짜 L+0x32 = SR+0xb2)
    const options = optionsFor(seasonOpponentOf(save.state.record), leagueSideOf(save.state.record.games, save.state.record.teamId))
    if (options === null) return
    enterPreGameSquad({ kind: '정규', options })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  }, [enterPreGameSquad, optionsFor, save])
  /** 0xd7 OK (0xa734) — 잠긴 칸 팝업·레벨업 창은 화면(`AceSelectScreen`)이 한다 */
  const choosePreGameAceAction = useCallback(
    (cell: number) => {
      if (save === null || pendingGame === null) return
      const step = choosePreGameAce(preGameAces, cell)
      setPreGameAces(step.aces)
      if (step.kind === '경기정보') enterMatchInfo(save, pendingGame, step.aces)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [enterMatchInfo, pendingGame, preGameAces, save],
  )
  /**
   * 0xd7 CLR (0xa900). 마투수 단계에서 나가면 포스트시즌 0xef · 그 밖 0xd8 이다.
   * 0xd8 로 돌아가면 들어옴 0x4cb8 이 다시 돌지만 **이전 상태가 0xd7** 이라 저장하지 않고,
   * 그 화면의 취소(0x48ea, 이전 상태 == 0xc9 일 때만)도 먹지 않는다 — 원본 그대로.
   */
  const cancelPreGameAceAction = useCallback(() => {
    if (save === null) return
    const step = cancelPreGameAce(preGameAces, save.state.record.inPostseason)
    if (step.kind === '고르기') return setPreGameAces(step.aces)
    setPendingGame(null)
    if (step.scene === SEASON_SCENE_STATE.다음경기) return nextGameEntered(save, false, true)
    setScene(step.scene)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  }, [nextGameEntered, preGameAces, save])
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
    setIsMatchSettingsOpen(false)
    setGameKind(pendingGame.kind)
    // 새 경기 — +0x4e = 1 과 첫 블록(0x84a0 · 0x1fdb0 칸 0xc · 0xd)은 경기 화면이 세운 첫 진행으로 `saveGameProgress` 가 쓴다
    setResumeGame(null)
    // 0x6548 이 돌린 저장 레코드 차례로 명단을 세운다 — 0번 선발 · 나머지 벤치 차례 (`withOwnRecordRotation`)
    const prepared = withOwnRecordRotation({
      ...pendingGame.options,
      settings: seasonMatchSettingsRef.current,
      ourEntryOrder: entryOrderOf(roster),
      // 투수 스태미나 +0x2c — 시즌 내내 이어진 값으로 선다. 국가대항전은 두 팀 모두 10000(기본)이다
      ...(isCup ? {} : staminaOptionsOf(save, pendingGame.options.opponentTeamId)),
      ...withAces,
    })
    setOwnRotationShift(prepared.shift)
    setGameOptions(withGameSettings(prepared.options))
    setPendingGame(null)
    setScene(SEASON_SCENE_STATE.경기직전)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  }, [clearGameRecord, pendingGame, preGameAces, save, withGameSettings])
  /** 0xdd CLR (0x844e) — 국가대항전이면 0xf4(웹은 대회 화면), 아니면 0xd7 을 다시 들어온다(0x5268) */
  const cancelMatchInfo = useCallback(() => {
    if (pendingGame === null) return
    setIsMatchSettingsOpen(false)
    const next = matchInfoCancelScene(pendingGame.kind === '국가대항전')
    if (next === SEASON_SCENE_STATE.선수단) return enterPreGameSquad(pendingGame)
    setPendingGame(null)
    setScene(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  }, [enterPreGameSquad, pendingGame])
  /** 0xdd '0' (0x857a) — `0x5fef4(메뉴, 열림 뒤집기)` */
  // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  const toggleMatchSettings = useCallback(() => setIsMatchSettingsOpen((open) => !open), [])
  /**
   * 0xdd 설정 창 확인 — 전역 m = 1 칸을 되쓰고 0x1f1b9 로 **전역 저장만** 쓴다(시즌 파일은 안 쓴다 — 0xe0 에서 고친 명단은
   * 아직 메모리에만 있다, `pressEntryKeyAction`). 전역 칸 손잡이가 없으면(시험) 시즌 저장 칸에 적되 마지막으로 파일에 쓴 시즌
   * 위에 얹는다(`writeGlobalField`)
   */
  const applyMatchSettings = useCallback(
    (settings: MatchProgressSettings) => {
      setIsMatchSettingsOpen(false)
      const slot = matchSettingsSeenSlot
      if (slot?.readSeasonSettings !== undefined && slot.writeSeasonSettings !== undefined) {
        slot.writeSeasonSettings(settings)
        setGlobalMatchSettings(settings)
        return
      }
      if (latestSave.current === null) return
      writeGlobalField({ matchSettings: settings })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [matchSettingsSeenSlot, writeGlobalField],
  )
  return {
    enterMatchInfo,
    confirmNextGame,
    choosePreGameAceAction,
    cancelPreGameAceAction,
    startPendingGame,
    cancelMatchInfo,
    toggleMatchSettings,
    applyMatchSettings,
  }
}

/** `useMatchInfoActions` 까지 선 값 */
export type MatchInfoActionsContext = NextGameStartContext & ReturnType<typeof useMatchInfoActions>
