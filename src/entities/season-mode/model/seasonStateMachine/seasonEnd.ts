import { MANAGEMENT_CYCLE, SEASON_GAME_COUNT, type SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { opponentOf } from '@/entities/season-mode/model/seasonStateMachine/otherSlices'
import { SEASON_PHASE, SEASON_SCENE_STATE, type SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine/states'

/**
 * 관리 메뉴가 열리는가 — 경기 수가 **짝수**일 때만이다 (P4 1b, StrHOWTO[18] "2경기마다").
 * 0·2·4·…·44 뒤에 열리므로 45번째 경기 뒤(홀수)는 관리 없이 바로 다음 화면으로 간다.
 */
export function opensManagementMenu(record: SeasonRecord): boolean {
  return record.games % MANAGEMENT_CYCLE === 0
}

/**
 * 경기 뒤 마무리(0xf1)에서 확인을 눌렀을 때 (`0x49a4`).
 * 포스트시즌이면 결산, 아니면 2경기 주기에 따라 관리 메뉴 또는 다음경기.
 */
export function afterGameNext(record: SeasonRecord): SeasonSceneState {
  if (record.inPostseason) return SEASON_SCENE_STATE.시즌결산
  return opensManagementMenu(record) ? SEASON_SCENE_STATE.관리메뉴 : SEASON_SCENE_STATE.다음경기
}

/** 오늘 붙는 상대 — 리그 일정표는 `entities/league` 가 들고 있다 (일차 = 치른 경기 수) */
export function seasonOpponentOf(record: SeasonRecord): number {
  return opponentOf(record.games, record.teamId)
}

/** 정규시즌이 끝났는가 — 리그 하루 끝(`0xb818c`)이 날짜 45 를 보고 포스트시즌을 연다 */
export function isRegularSeasonOver(record: SeasonRecord): boolean {
  return !record.inPostseason && record.games >= SEASON_GAME_COUNT
}

/**
 * 시즌 끝 이벤트 사슬 (P4 2b 확정). 각 단계는 "이전 = 다음 상태, 다음 = 0xd3" 로
 * 이벤트를 먼저 틀고 돌아온다.
 */
export interface SeasonEndStep {
  readonly state: SeasonSceneState
  readonly phase: number
  /** 이 단계가 트는 s_event id (정규시즌 순위 단계는 순위에 따라 갈린다) */
  readonly eventId: number | null
  readonly next: SeasonSceneState
}

export const SEASON_END_CHAIN: readonly SeasonEndStep[] = [
  {
    state: SEASON_SCENE_STATE.포스트시즌시작,
    phase: SEASON_PHASE.포스트시즌시작,
    eventId: 392,
    next: SEASON_SCENE_STATE.타자시상,
  },
  {
    state: SEASON_SCENE_STATE.타자시상,
    phase: SEASON_PHASE.타자시상,
    eventId: 370,
    next: SEASON_SCENE_STATE.투수시상,
  },
  {
    state: SEASON_SCENE_STATE.투수시상,
    phase: SEASON_PHASE.투수시상,
    eventId: 371,
    next: SEASON_SCENE_STATE.최우수선수,
  },
  {
    state: SEASON_SCENE_STATE.최우수선수,
    phase: SEASON_PHASE.최우수선수,
    eventId: 376,
    next: SEASON_SCENE_STATE.정규시즌순위,
  },
  {
    state: SEASON_SCENE_STATE.정규시즌순위,
    phase: SEASON_PHASE.정규시즌순위,
    eventId: null, // 순위로 갈린다 — `regularSeasonRankEventId`
    next: SEASON_SCENE_STATE.시즌결산,
  },
]

/** 정규시즌 순위(0부터) → 이벤트 (`0x6c90`: 0 → 401 · 1~3 → 402 · 4 이상 → 403) */
export function regularSeasonRankEventId(rank: number): number {
  if (rank === 0) return 401
  if (rank <= 3) return 402
  return 403
}

/**
 * 한국시리즈 결과 팝업을 닫은 뒤 (`0x87b4`).
 * 연차 idx 가 **짝수**(1·3·5·7·9년차)면 국가대항전, 홀수면 곧장 새 해다.
 * 이벤트 461 "2년에 한번 치러지는 국가대항전" 과 맞는다.
 */
export function afterKoreanSeries(record: SeasonRecord): SeasonSceneState | '새해' {
  return (record.yearIndex & 1) === 0 ? SEASON_SCENE_STATE.국가대항전안내 : '새해'
}
