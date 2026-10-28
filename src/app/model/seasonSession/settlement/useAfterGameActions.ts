import { useCallback } from 'react'
import type { TeamGameSummary } from '@/features/play-team-game/model/teamGameFlow'
import { rollSceneLoadingTip } from '@/entities/game/model/sceneLoadingTip'
import { activeSound } from '@/shared/api/audio/soundPort'
import { type SeasonRecord, SEASON_GAME_COUNT } from '@/entities/season-mode/model/seasonRecord'
import { isBugFixed } from '@/shared/config/bugfixes'
import {
  SEASON_PHASE,
  SEASON_END_CHAIN,
  SEASON_SCENE_STATE,
  afterGameNext,
  TRADE_REQUEST_MENU_CURSOR,
} from '@/entities/season-mode/model/seasonStateMachine'
import { finishRegularSeason } from '@/entities/league/model/seasonEnd'
import { startPostseason } from '@/entities/league/model/league'
import { rollTradeRequest } from '@/entities/season-mode/model/tradeRequest'
import { NO_CHAMPION, SEASON_MANAGEMENT_BGM, SEASON_STAT_MODE } from '@/app/model/seasonSession/constants/seasonConstants'
import { cpuRosterOf, tradeRecordRosterOf } from '@/app/model/seasonSession/roster/roster'
import type { SettleGameContext } from '@/app/model/seasonSession/settlement/useSettleGame'

/** `useSeasonSession` 몸통 문장 103~112 을 그대로 옮겼다 (r346) — 부르는 차례 · 훅 차례는 `useSeasonSession` 그대로 */
export function useAfterGameActions(ctx: SettleGameContext) {
  const { settledGame, settleGame, random, freshScene, setResumeGame, setGameOptions, setScene, save, commit, recordStat, setTradeRequest } = ctx
  const { nextGameEntered, setTradeRequestAlertOpen, setMenuCursors } = ctx
  /**
   * **정산 진입** (`TeamGameScreen.onSettlementEnter` — 경기 끝 결과 판 OK → 상태 0x19, 진입 0x4ea0c).
   * 원본 0x4ea0c 는 이 자리에서 정산을 **다** 한다 — 기록 달성 G(4ec5a) · 갈래별 리그·평가·CPU 경기·하루 끝(4f216~4f31e) ·
   * 경기 끝 꼬리(4f374~4f3b2) 뒤 0x1fded · 0x22755(저장, 1) 파일 쓰기 → +0x4c+모드 = 0(0x4f3d6) → 0x1f1b9.
   * 그래서 결과 화면을 보는 사이에 창을 닫아도 정산은 남는다. 화면 넘김(0xe9 · 결산 · 대회)은 결과 화면 확인(`finishGame`)이다.
   */
  const enterGameSettlement = useCallback(
    (summary: TeamGameSummary) => {
      if (settledGame.current !== null) return
      settledGame.current = settleGame(summary)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [settleGame],
  )
  /**
   * 결과 화면 확인 — 정산 진입에서 정해 둔 다음 장면으로 간다. 정산 진입을 거치지 않고 왔으면(테스트 · 옛 길) 여기서 정산한다.
   */
  /**
   * **장면 0x105 의 상태 1 — 자원 적재 0x75fc**(직접 떴다, 그리기 나무 0xedb6 의 edd0 `cmp #1` → 0xee6a). 로딩 판 0x667f9 · 진행 막대
   * 0x54121(판, 7) 뒤 76cc `0x53dbd(판, [this+0xcc])` — StrTIP 첫 줄(73)로 rand(0, 73)(53dde, 경기 장면 상태 7 의 0x39f88 과 같은
   * 함수). 이어서 적재 뒤 7878 `0xbcb49([this+0x24])` 로 진입 분기 0xcb 로 간다. 곧 장면 0x105 를 세울 때마다 한 번, 그 장면의 어느
   * 굴림보다 앞이다. 웹 시즌은 로딩 판을 안 그려 값은 버린다.
   */
  const rollSceneLoadTip = useCallback(() => {
    rollSceneLoadingTip(random)
  }, [random])
  /** 들어와 장면 0x105 를 세운다 — 셋업 0x3b14 가 mgr+0x304 = 1, 이어서 상태 1 적재의 팁 굴림 */
  const constructScene = useCallback(() => {
    freshScene.current = true
    rollSceneLoadTip()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  }, [rollSceneLoadTip])
  /** 관리 메뉴 0xc9 확인 키(−5 · '5') — 0x8f82 가 칸을 보기 전에 mgr+0x304 = 0 (490 쿨다운 검사가 다시 선다) */
  const pressManagementConfirm = useCallback(() => {
    freshScene.current = false
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  }, [])
  const finishGame = useCallback(
    (summary: TeamGameSummary) => {
      const settled = settledGame.current ?? settleGame(summary)
      settledGame.current = null
      setResumeGame(null)
      // 경기 장면이 끝나면 장면 0x105 를 새로 세운다(0x3874 가 지운 뒤 0x3b14) — 상태 1 의 팁 굴림이 그 장면의 맨 앞이다
      if (settled !== null) rollSceneLoadTip()
      if (settled === null) return
      setGameOptions(null)
      if (settled.jingle !== null) activeSound().play(settled.jingle)
      setScene(settled.next)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [rollSceneLoadTip, settleGame],
  )
  /** 관중수입 창에서 확인 — 정산된 레코드를 받아 경기 뒤 마무리로 간다 (0xf1) */
  const confirmIncome = useCallback(
    (record: SeasonRecord) => {
      if (save === null) return
      // 0xe9 갱신 0xdea0 끝(e114~e130)은 다음 상태(0xee/0xef/0xf1 · 사이 0xd3)를 걸고 저장만 한다 — phase(SR+0x50)는
      // 경기 끝 0x4ea0c 가 쓴 2 그대로다. 0xf1 진입 0x953c 도 안 바꾼다. 그래서 0xe9·0xf1 에서 끄고 이어하면 진입 분기 0xcb 가
      // 다시 0xe9 로 보내 평가 이벤트·구내매점 감소·트레이드 요청을 또 탄다 — 원본 버그 B-29. phase 는 0xc9(3)·0xd8(4) 진입이 고친다.
      // 고침(`bugfixes.json` B-29, 기본 켬): 여기서 phase 를 0xe9 다음 자리로 옮겨 저장한다 — 정규시즌이 끝나는 경기면 시즌 끝 사슬의
      // 첫 칸(0xb → 0xee), 그 밖은 기본(3 — 진입 분기 0xcb 가 경기 수 짝수면 0xc9 · 홀수면 0xd8, 곧 0xf1 확인 `afterGameNext` 와 같다).
      // 0xf1(경기 뒤 마무리)에서 끄고 이어하면 그 판과 CPU 트레이드 요청은 건너뛴다(요청은 원래 저장에 안 남는 칸이다). 굴림 없음
      const settled: SeasonRecord = isBugFixed('B-29')
        ? { ...record, phase: record.games >= SEASON_GAME_COUNT ? SEASON_PHASE.포스트시즌시작 : SEASON_PHASE.기본 }
        : record
      commit({ ...save, state: { ...save.state, record: settled } })
      if (settled.games >= SEASON_GAME_COUNT) {
        /*
         * 정규시즌 종료 (0xb818c → 0xb80a8): 1위면 `+0x7a` 를 늘리고 대진을 짠다.
         * 국가대항전은 여기가 아니라 **결산을 닫은 뒤**(`finishSeason` → `afterKoreanSeries`)다.
         *
         * 포스트시즌 경기는 여기서 치르지 않는다 — 원본도 **결산 화면(0xef)** 이
         * 라운드를 하나씩 진행시킨다 (내 팀 차례면 사람이 치고, 아니면 0xc2760 으로 돌린다).
         */
        const end = finishRegularSeason(save.league, settled.teamId)
        // 같은 1위 갈래(b82a4~b830a)가 SR+0x7a 다음에 통계 [mgr+0xc8]+0x100(기록연감 셀 10 "시즌모드 우승")을 +1 하고 저장한다.
        // 전역기록 +0x5e(b82ce~b82ea)도 +1 하지만 그 칸을 읽는 곳이 없다(이진 전체 ldrh 훑기 — 이 증가 하나) → 웹은 안 둔다
        if (end.isRegularSeasonFirst) recordStat?.({ kind: '리그1위', mode: SEASON_STAT_MODE })
        commit({
          ...save,
          // 포스트시즌 선발·벤치 차례는 정규시즌이 끝났을 때의 리그 투수 레코드 차례에서 이어 돈다 (3eb7301)
          series: startPostseason(end.ranking, save.league.pitcherOrders),
          ranking: end.ranking,
          state: {
            ...save.state,
            record: {
              ...settled,
              regularSeasonFirsts: settled.regularSeasonFirsts + (end.isRegularSeasonFirst ? 1 : 0),
              inPostseason: true,
              // SR+0xb2 = L+0x32 — 포스트시즌 시작 0xb80a8 이 0 으로 둔다(b811c). 그래서 0xe9 가 (0 ? 0xee : 0xef) 로 가고,
              // 시상 사슬 중에 끄고 이어하면 진입 분기 0xcb 가 phase 로 남은 시상을 다시 잡는다 (`postseasonDayOf`)
              games: 0,
              postseasonChampion: NO_CHAMPION,
            },
          },
        })
        // 원본 시즌 끝 사슬의 첫 칸 (0xee → 시상 셋 → 정규시즌순위 → 결산)
        return setScene(SEASON_END_CHAIN[0].state)
      }
      // 0xe9 → (0xd3 평가 이벤트) → **0xf1 경기 뒤 마무리**. 진입 0x953c: CPU 트레이드 요청 0x93c8 을 굴려
      // this+0x148 에 담고(요청 횟수 SR+0x17a 는 레코드) 배경음 4 를 반복으로 튼다 (0x6ea6d(소리, 4, −1, 1))
      // 0x93c8 은 두 팀 레코드 배열을 칸으로 뽑는다 — 로테이션으로 섞인 레코드 차례로 넘긴다.
      // 내 팀 쪽은 캐시 포인터 [this+0xa4](94a0)지만 대회를 치른 해의 새 해 뒤에도 상대국 슬롯을 안 본다(U-135, r104 직접 뜸):
      // 0xf1 진입 0x953c 를 부르는 길은 0xe9 진입 0xdea0 의 e10a 하나 · 0xe9 는 0xcb 진입 0x4b50 의 4ba6 하나이고, 0x4b50 은 그 앞
      // 4b6a~4b7c 에서 [this+0xa4] = 0x1f570(저장, SR[1]) 을 다시 잡는다. 새 해 0x6e0c 의 리그 초기화(0xa305c → 0xb7b34)가 L+0xac 를
      // 지운 뒤라 리그 칸이다. 대회 중에는 경기 끝 0x4ea0c(4f02e~4f044)가 L+0xac 면 phase 2 를 안 세워 0xcb 가 0xe9 로 안 간다.
      // 곧 [this+0xa4] 가 상대국 슬롯인 동안(대회 경기 뒤 ~ 새 해 뒤 첫 0xcb) 0x93c8 은 돌지 않는다 — 버그는 새 해 사기(6ea4)에만 드러난다
      // 그날 경기들이 넣은 마선수가 열 팀 레코드에 남아 있다 — 타자 9번 칸이 마타자다 (`SeasonSave.recordAces`, U-105 r154)
      const rolled = rollTradeRequest(
        random,
        settled,
        tradeRecordRosterOf(save, settled.teamId, save.roster),
        (team) => tradeRecordRosterOf(save, team, cpuRosterOf(save, team)),
        (team) => save.recordAces?.[team],
      )
      commit({ ...save, state: { ...save.state, record: rolled.record } })
      setTradeRequest(rolled.request)
      activeSound().playBgm(SEASON_MANAGEMENT_BGM)
      setScene(SEASON_SCENE_STATE.경기뒤마무리)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
    [commit, random, recordStat, save],
  )
  /** 0xf1 키 0x49a4 — 확인이면 포스트시즌 0xef · 경기 수 짝수 0xc9 · 홀수 0xd8 */
  const confirmDayResults = useCallback(() => {
    if (save === null) return
    const next = afterGameNext(save.state.record)
    // 홀수 경기 뒤는 관리 메뉴를 건너뛰고 곧장 0xd8 — 들어옴 0x4cb8 이 phase 를 4 로 둔다
    if (next === SEASON_SCENE_STATE.다음경기) return nextGameEntered(save, false)
    setScene(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  }, [nextGameEntered, save])
  const answerTradeRequest = useCallback((accept: boolean) => {
    setTradeRequestAlertOpen(false)
    if (accept) {
      // 7440~7484 — 관리 메뉴(this+0x70)·구단관리(this+0x78) 커서를 칸 1 로 (구단관리 · 트레이드)
      setMenuCursors((cursors) => ({ ...cursors, management: TRADE_REQUEST_MENU_CURSOR, teamMenu: TRADE_REQUEST_MENU_CURSOR }))
      return setScene(SEASON_SCENE_STATE.트레이드영입선수)
    }
    setTradeRequest((request) => ({ ...request, isRequested: false }))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  }, [])
  const cancelTradeRequest = useCallback(() => {
    setTradeRequest((request) => ({ ...request, isRequested: false }))
    setScene(SEASON_SCENE_STATE.구단관리)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  }, [])
  const closeTradeResult = useCallback(() => {
    setTradeRequest((request) => ({ ...request, isRequested: false }))
    setScene(SEASON_SCENE_STATE.관리메뉴)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  }, [])
  return {
    enterGameSettlement,
    constructScene,
    pressManagementConfirm,
    finishGame,
    confirmIncome,
    confirmDayResults,
    answerTradeRequest,
    cancelTradeRequest,
    closeTradeResult,
  }
}

/** `useAfterGameActions` 까지 선 값 */
export type AfterGameActionsContext = SettleGameContext & ReturnType<typeof useAfterGameActions>
