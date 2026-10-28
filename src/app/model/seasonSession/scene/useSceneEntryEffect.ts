import { useRef, useEffect } from 'react'
import {
  type SeasonSceneState,
  SEASON_SCENE_STATE,
  SEASON_PHASE,
  SEASON_END_CHAIN,
  regularSeasonRankEventId,
} from '@/entities/season-mode/model/seasonStateMachine'
import { isBugFixed } from '@/shared/config/bugfixes'
import { seasonGameEvaluationLineOf } from '@/entities/season-mode/model/seasonGameEvaluation'
import { settleGameIncome } from '@/entities/season-mode/model/seasonAttendance'
import { pollSeasonEvents, OPENING_EVENT_ID, YEAR_GOAL_EVENT_ID, SEASON_GOAL_INTRO_EVENT_ID } from '@/entities/season-mode/model/seasonEventFlow'
import { NO_TRADE_REQUEST } from '@/entities/season-mode/model/tradeRequest'
import { activeSound } from '@/shared/api/audio/soundPort'
import { opensSeasonAutobotBat, SEASON_AUTOBOT_BAT_HIDDEN_ID, judgeSeasonEnding } from '@/entities/season-mode/model/seasonRewards'
import { seasonEndingBgmOf } from '@/app/model/screenBgm'
import { rankingOf } from '@/entities/league/model/league'
import { SEASON_AWARD_INTRO_EVENT_ID } from '@/widgets/season/lib/seasonAwardEvents'
import { rollSeasonMvpKind } from '@/app/model/seasonSession/awards/seasonAwards'
import { SEASON_MANAGEMENT_BGM } from '@/app/model/seasonSession/constants/seasonConstants'
import type { SeasonPersistenceContext } from '@/app/model/seasonSession/state/useSeasonPersistence'

/** `useSeasonSession` 몸통 문장 67~68 을 그대로 옮겼다 (r346) — 부르는 차례 · 훅 차례는 `useSeasonSession` 그대로 */
export function useSceneEntryEffect(ctx: SeasonPersistenceContext) {
  const { scene, setSummaryEntry, setIncomeEvaluation, save, commit, eventCursor, event100Awarded, newPlayerFlag, freshScene, random } = ctx
  const { startEvent, tradeRequest, setTradeRequestAlertOpen, setTradeRequest, autobotBatInputRef, openedHiddenIds, setOpenedHiddenIds } = ctx
  const { summaryEntrySerial, seasonMvpKind, recordSourceNow } = ctx
  /**
   * 상태에 **막 들어온 틀** (0xe9ac 의 e9c2: 상태가 바뀐 틀에만 ① 상태별 진입 함수 ② 이벤트 폴링이 돈다).
   * 같은 상태로 다시 가라고 해도(관리 메뉴 → 관리 메뉴) 바뀐 것이 아니라 돌지 않는다.
   */
  const enteredScene = useRef<SeasonSceneState | null>(null)
  // eslint-disable-next-line react-hooks/immutability -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  useEffect(() => {
    if (enteredScene.current === scene) return
    enteredScene.current = scene
    // 결산을 떠나면 그 진입은 끝났다 — 다시 들어올 때 지난 진입 값을 새 진입으로 읽지 않게 비운다
    if (scene !== SEASON_SCENE_STATE.시즌결산) setSummaryEntry(null)
    if (scene !== SEASON_SCENE_STATE.관중수입) setIncomeEvaluation(null)
    if (save === null) return
    const { record } = save.state

    // 0xe9 갱신 0xdea0 — 기록 줄을 지어(구내매점 "(+200)" 은 줄이기 전 SR+0x55) 0x8a6fc 로 평가 이벤트를 쌓는다. 그 안에서
    // 구내매점 SR+0x55 가 하나 줄고(R13 10절) e120~e130 이 저장한다 — phase 는 경기 끝의 2 그대로라 이어하면 0xe9 를 다시 탄다
    if (scene === SEASON_SCENE_STATE.관중수입) {
      // 고침(`bugfixes.json` B-29, 기본 켬): 이 경기 정산을 이미 했으면(끄고 이어함) 구내매점을 다시 줄이지 않고 만료 안내도 다시
      // 안 붙인다 — 평가 글은 같은 레코드로 다시 보인다. 굴림 없음
      if (isBugFixed('B-29') && record.incomeSettled === true) {
        setIncomeEvaluation({ line: seasonGameEvaluationLineOf(record), storeExpired: false })
        return
      }
      const settlement = settleGameIncome(record)
      setIncomeEvaluation({ line: seasonGameEvaluationLineOf(record), storeExpired: settlement.storeExpired })
      const settledRecord = isBugFixed('B-29') ? { ...settlement.record, incomeSettled: true } : settlement.record
      commit({ ...save, state: { ...save.state, record: settledRecord } })
      return
    }

    if (scene === SEASON_SCENE_STATE.관리메뉴 || scene === SEASON_SCENE_STATE.외출지도) {
      // 0xc9 진입 0x4efc: SR+0x1bc == 0 이면 phase = 3 · 저장 (4f78~4f9c)
      const entered =
        scene === SEASON_SCENE_STATE.관리메뉴 && !record.endingSeen && record.phase !== SEASON_PHASE.기본
          ? { ...record, phase: SEASON_PHASE.기본 }
          : record
      const polled = pollSeasonEvents(
        eventCursor.current,
        {
          scene,
          record: entered,
          teamMorale: save.state.teamMorale,
          event100Awarded,
          newPlayerFlag: newPlayerFlag.current,
          isFreshScene: freshScene.current,
        },
        random,
      )
      // eslint-disable-next-line react-hooks/immutability -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
      eventCursor.current = polled.cursor
      if (polled.record !== record) commit({ ...save, state: { ...save.state, record: polled.record } })
      const { poll } = polled
      if (poll.kind === '오프닝') {
        // eslint-disable-next-line react-hooks/immutability -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
        newPlayerFlag.current = false
        return startEvent(OPENING_EVENT_ID, scene)
      }
      if (poll.kind === '연초목표') return startEvent(YEAR_GOAL_EVENT_ID, scene)
      if (poll.kind === '이벤트') return startEvent(poll.eventId, scene)
      // 0xec10 — 아무 이벤트도 안 틀었고 0xc9 이고 this+0x148 ≠ 0 이면 요청 알림 [203] (팝업 0x27).
      // 그 앞 0xec04 — 엔딩 플래그 [0x1552adc](이벤트 실행기 종류 21 명령이 0x8d4d2 에서 1)가 서 있으면 지우고 그 틀만 알림을
      // 건너뛴다(0xec0c · 0xec0e → 0xec6a). 0xe9ac 는 0xc9 · 0xd1 에서 **틀마다** 폴링하므로(P4 1a) 다음 틀에 알림이 그대로 뜬다 —
      // 한 틀 늦을 뿐이라 웹은 따로 두지 않는다.
      if (scene === SEASON_SCENE_STATE.관리메뉴 && tradeRequest.isRequested) setTradeRequestAlertOpen(true)
      return
    }

    // 팀 고르기 0xe4 진입 0x4774 — this+0x148 20바이트를 memset 0 (보통 트레이드는 요청 플래그가 늘 0)
    if (scene === SEASON_SCENE_STATE.트레이드) {
      setTradeRequest(NO_TRADE_REQUEST)
      return
    }

    // 결산 0xef 진입 0x6900 — 들어갈 때마다 머리에서 세 모드 해금 0x29 를 본다. 새로 열리면 해금 알림 창(0x62368 →
    // 0x74ef5, 꼬리표 0)을 띄우고 그 진입의 리그 1위 G 검사를 건너뛴다(0x69ce → 0x6ac8). 창을 닫으면 0x87e8 이 G 검사를
    // 한 번 돌린다. 안 열리면 진입이 곧장 G 검사를 한 번(0x69d4~0x6ac0) — 결산 화면(`SeasonSummaryScreen`)이 이 값으로
    // 그 창과 검사를 맡는다
    if (scene === SEASON_SCENE_STATE.시즌결산) {
      // 0xef 진입 0x6900 — SR+0x50 = 0xf · 저장 뒤 조건 없이 관리 화면 배경음 4 (6926~6934 `0x6ea6d(소리, 4, −1, 1)`)
      activeSound().playBgm(SEASON_MANAGEMENT_BGM)
      const input = autobotBatInputRef.current?.()
      const opens =
        input !== undefined &&
        opensSeasonAutobotBat(record, {
          ...input,
          globalOpenedHiddenIds: [...input.globalOpenedHiddenIds, ...openedHiddenIds],
        })
      if (opens) setOpenedHiddenIds((opened) => [...opened, SEASON_AUTOBOT_BAT_HIDDEN_ID])
      // eslint-disable-next-line react-hooks/immutability -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
      summaryEntrySerial.current += 1
      setSummaryEntry({ serial: summaryEntrySerial.current, opensAutobotBat: opens })
      // 0x690e~0x6922 — 머리에서 SR+0x50 = 0xf 를 쓰고 0x1fded · 0x22755 로 저장한다(조건 없이, 포스트시즌 경기 뒤 다시 들어와도)
      commit({ ...save, state: { ...save.state, record: { ...record, phase: SEASON_PHASE.결산 } } })
      return
    }

    // 10년차 엔딩 0xf5 진입 0x6be8 — 엔딩 판정 0xa3085 가 0(비 인기 구단 — 보너스 표 0xcbc2e[0] = 0)이면 SR+0x7b = 1 · 저장
    // (6c12~6c2e) — 키 0x6b3c 가 보너스 팝업 없이 넘긴다. 이어서 배경음을 예약한다(0 → 52 · 그 밖 46, `seasonEndingBgmOf`)
    if (scene === SEASON_SCENE_STATE.엔딩) {
      const endingIndex = judgeSeasonEnding(record)
      if (endingIndex === 0 && !record.endingBonusReceived) {
        commit({ ...save, state: { ...save.state, record: { ...record, endingBonusReceived: true } } })
      }
      activeSound().playBgm(seasonEndingBgmOf(endingIndex))
      return
    }

    // 시즌 끝 사슬 — 진입 함수마다 phase 를 세우고 저장한다 (0x6d6c 0xb · 0xe854 0xc · 0xe900 0xd · 0xe7ac 0xe · 0x6c90 0x10)
    const step = SEASON_END_CHAIN.find((candidate) => candidate.state === scene)
    if (step === undefined) return
    const staged = { ...save, state: { ...save.state, record: { ...record, phase: step.phase } } }
    commit(staged)
    // 0xee — 392 를 틀고 [다음 0xeb] (6d9c~6db0)
    if (scene === SEASON_SCENE_STATE.포스트시즌시작) return startEvent(SEASON_GOAL_INTRO_EVENT_ID, step.next)
    // 0xf0 — 정규시즌 순위 0xb7aa0(L, 팀, 1) 로 401 · 402 · 403 (6cb2~6cee)
    if (scene === SEASON_SCENE_STATE.정규시즌순위) {
      const rank = Math.max(0, rankingOf(save.league).indexOf(record.teamId))
      return startEvent(regularSeasonRankEventId(rank), step.next)
    }
    // 0xeb 0xe854 · 0xec 0xe900 — 0x8dad5(evmgr, 0xc · 0xd) 로 타이틀 칸을 채우고 370 · 371 을 튼다(이전 = 다음 상태, 다음 = 0xd3)
    if (scene === SEASON_SCENE_STATE.타자시상) return startEvent(SEASON_AWARD_INTRO_EVENT_ID.타자, step.next)
    if (scene === SEASON_SCENE_STATE.투수시상) return startEvent(SEASON_AWARD_INTRO_EVENT_ID.투수, step.next)
    // 0xed 0xe7ac — 0x8dd61(evmgr) 가 표 0xd4f34 에서 rand(0..6) 으로 MVP 순위 종류를 고른 뒤(빈 순위표면 다시) 376 을 튼다
    if (scene === SEASON_SCENE_STATE.최우수선수) {
      // eslint-disable-next-line react-hooks/immutability -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
      seasonMvpKind.current = rollSeasonMvpKind(save, recordSourceNow(), random)
      return startEvent(SEASON_AWARD_INTRO_EVENT_ID.MVP, step.next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 옮긴 하위 훅(r346): setter·ref 는 useSeasonSession 의 useState·useRef 값이고 의존성은 옮기기 전 그대로
  }, [commit, event100Awarded, openedHiddenIds, random, recordSourceNow, save, scene, startEvent, tradeRequest.isRequested])
  return {}
}

/** `useSceneEntryEffect` 까지 선 값 */
export type SceneEntryEffectContext = SeasonPersistenceContext & ReturnType<typeof useSceneEntryEffect>
