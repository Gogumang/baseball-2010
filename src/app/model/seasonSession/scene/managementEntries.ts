import { SEASON_SCENE_STATE, SEASON_PHASE } from '@/entities/season-mode/model/seasonStateMachine'
import { isBugFixed } from '@/shared/config/bugfixes'
import { seasonGameEvaluationLineOf } from '@/entities/season-mode/model/seasonGameEvaluation'
import { settleGameIncome } from '@/entities/season-mode/model/seasonAttendance'
import { pollSeasonEvents, OPENING_EVENT_ID, YEAR_GOAL_EVENT_ID } from '@/entities/season-mode/model/seasonEventFlow'
import { NO_TRADE_REQUEST } from '@/entities/season-mode/model/tradeRequest'
import { incomeEvaluationAtom, tradeRequestAlertOpenAtom, tradeRequestAtom } from '@/app/model/seasonSession/atoms/uiAtoms'
import { eventCursorAtom, freshSceneAtom, newPlayerFlagAtom } from '@/app/model/seasonSession/atoms/eventAtoms'
import { type SceneEntry, withSeasonRecord } from '@/app/model/seasonSession/scene/sceneEntry'

/**
 * 0xe9 갱신 0xdea0 — 기록 줄을 지어(구내매점 "(+200)" 은 줄이기 전 SR+0x55) 0x8a6fc 로 평가 이벤트를 쌓는다. 그 안에서
 * 구내매점 SR+0x55 가 하나 줄고(R13 10절) e120~e130 이 저장한다 — phase 는 경기 끝의 2 그대로라 이어하면 0xe9 를 다시 탄다
 */
export function enterIncomeScene({ atoms, save, commit }: SceneEntry): void {
  const { record } = save.state
  // 고침(`bugfixes.json` B-29, 기본 켬): 이 경기 정산을 이미 했으면(끄고 이어함) 구내매점을 다시 줄이지 않고 만료 안내도 다시
  // 안 붙인다 — 평가 글은 같은 레코드로 다시 보인다. 굴림 없음
  if (isBugFixed('B-29') && record.incomeSettled === true) {
    atoms.set(incomeEvaluationAtom, { line: seasonGameEvaluationLineOf(record), storeExpired: false })
    return
  }
  const settlement = settleGameIncome(record)
  atoms.set(incomeEvaluationAtom, { line: seasonGameEvaluationLineOf(record), storeExpired: settlement.storeExpired })
  const settledRecord = isBugFixed('B-29') ? { ...settlement.record, incomeSettled: true } : settlement.record
  commit(withSeasonRecord(save, settledRecord))
}

/**
 * 이벤트 폴링 0x8be80 한 번(굴림) — 판정에 들어갈 진입 레코드는 0xc9 진입 0x4efc 가 phase 를 3 으로 고친 것이다
 * (SR+0x1bc == 0 이면 phase = 3 · 저장, 4f78~4f9c). 커서는 곧바로 옮긴다
 */
function rollEnteredScenePoll({ atoms, scene, save, random, event100Awarded }: SceneEntry) {
  const { record } = save.state
  const resetsPhase = scene === SEASON_SCENE_STATE.관리메뉴 && !record.endingSeen && record.phase !== SEASON_PHASE.기본
  const polled = pollSeasonEvents(
    atoms.get(eventCursorAtom),
    {
      scene,
      record: resetsPhase ? { ...record, phase: SEASON_PHASE.기본 } : record,
      teamMorale: save.state.teamMorale,
      event100Awarded,
      newPlayerFlag: atoms.get(newPlayerFlagAtom),
      isFreshScene: atoms.get(freshSceneAtom),
    },
    random,
  )
  atoms.set(eventCursorAtom, polled.cursor)
  return polled
}

/** 이벤트를 폴링하는 장면(관리 메뉴 0xc9 · 외출 지도 0xd1 — 0xe9ac 가 이 둘에서 폴링한다, P4 1a)에 들어왔다 — 폴링 → 레코드가 바뀌었으면 저장 → 고른 이벤트를 틀거나 트레이드 요청 알림 */
export function enterEventPollingScene(entry: SceneEntry): void {
  const { atoms, scene, save, commit, startEvent, isTradeRequested } = entry
  const polled = rollEnteredScenePoll(entry)
  if (polled.record !== save.state.record) commit(withSeasonRecord(save, polled.record))
  const { poll } = polled
  if (poll.kind === '오프닝') {
    atoms.set(newPlayerFlagAtom, false)
    return startEvent(OPENING_EVENT_ID, scene)
  }
  if (poll.kind === '연초목표') return startEvent(YEAR_GOAL_EVENT_ID, scene)
  if (poll.kind === '이벤트') return startEvent(poll.eventId, scene)
  // 0xec10 — 아무 이벤트도 안 틀었고 0xc9 이고 this+0x148 ≠ 0 이면 요청 알림 [203] (팝업 0x27).
  // 그 앞 0xec04 — 엔딩 플래그 [0x1552adc](이벤트 실행기 종류 21 명령이 0x8d4d2 에서 1)가 서 있으면 지우고 그 틀만 알림을
  // 건너뛴다(0xec0c · 0xec0e → 0xec6a). 0xe9ac 는 0xc9 · 0xd1 에서 **틀마다** 폴링하므로(P4 1a) 다음 틀에 알림이 그대로 뜬다 —
  // 한 틀 늦을 뿐이라 웹은 따로 두지 않는다.
  if (scene === SEASON_SCENE_STATE.관리메뉴 && isTradeRequested) atoms.set(tradeRequestAlertOpenAtom, true)
}

/** 팀 고르기 0xe4 진입 0x4774 — this+0x148 20바이트를 memset 0 (보통 트레이드는 요청 플래그가 늘 0) */
export function enterTradeScene({ atoms }: SceneEntry): void {
  atoms.set(tradeRequestAtom, NO_TRADE_REQUEST)
}
