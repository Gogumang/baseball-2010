import { opponentOf } from '@/entities/league/model/league'
import { MANAGEMENT_CYCLE, SEASON_GAME_COUNT } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'

/**
 * 시즌모드 장면 0x105 의 상태 기계 — `docs/re/P4-season-flow.md` 1a·1b 절 (구조 확정).
 *
 * 갱신은 `0xe9ac`(vtable `0xcbbb0`[2]) 가 한 틀에 세 단계로 돌린다:
 *   ① 상태별 갱신(점프표 `0xcbea0`) → ② 시즌 이벤트 폴링 → ③ 입력(점프표 `0xcbf6c`)
 * 여기서는 그 중 **전이 규칙만** 옮긴다 (화면·그리기는 이 저장소의 다른 층이 맡는다).
 */

/** 서브 상태 번호 (원본 값 그대로) */
export const SEASON_SCENE_STATE = {
  진입분기: 0xcb,
  팀고르기: 0xca,
  팀결정확인: 0xc8,
  새시즌초기화: 0xcc,
  관리메뉴: 0xc9,
  시즌정보: 0xcd,
  구단관리: 0xce,
  트레이닝: 0xcf,
  아이템: 0xd0,
  아이템상점: 0xdc,
  외출지도: 0xd1,
  이벤트재생: 0xd3,
  선수단: 0xd7,
  다음경기: 0xd8,
  경기직전: 0xdd,
  구장관리: 0xea,
  트레이드: 0xe4,
  선수영입: 0xe2,
  선수고르기: 0xdf,
  관중수입: 0xe9,
  경기뒤마무리: 0xf1,
  포스트시즌시작: 0xee,
  타자시상: 0xeb,
  투수시상: 0xec,
  최우수선수: 0xed,
  정규시즌순위: 0xf0,
  시즌결산: 0xef,
  국가대항전안내: 0xf2,
  국가대항전: 0xf3,
  엔딩: 0xf5,
} as const
export type SeasonSceneState = (typeof SEASON_SCENE_STATE)[keyof typeof SEASON_SCENE_STATE]

/**
 * phase (`SR+0x50`) — 값의 뜻은 **쓰는 곳 기준**이다(유력, P4 1a).
 *   1 새 시즌 · 2 정규시즌 경기 끝 · 3 경기 끝 기본값/관리 메뉴 중 · 4 다음경기 화면
 *   6 엔딩 · 0xb~0xe 포스트시즌 단계 · 0xf 결산 · 0x10 정규시즌 순위
 */
export const SEASON_PHASE = {
  새시즌: 1,
  경기끝: 2,
  기본: 3,
  다음경기: 4,
  엔딩: 6,
  포스트시즌시작: 0xb,
  타자시상: 0xc,
  투수시상: 0xd,
  최우수선수: 0xe,
  결산: 0xf,
  정규시즌순위: 0x10,
} as const

export interface SceneEntryInput {
  /** 저장+0x42 — 진행 중인 시즌이 있는가 */
  readonly hasSeasonSave: boolean
  /** SR+0x1bc — 서 있으면 무조건 관리 메뉴로 간다 (칸 뜻 미해독) */
  readonly forceManagementMenu?: boolean
}

/**
 * 진입 분기 `0xcb`(= `0x4b50`) — 장면에 들어올 때마다(경기 뒤 포함) 한 번 돈다.
 *
 * ```
 * 저장+0x42 == 0 (시즌 없음)  → 0xca 팀 고르기
 * SR+0x1bc != 0               → 0xc9
 * phase 6·7 → 0xf5 | 2 → 0xe9 | 0xb → 0xee | 0x10 → 0xf0
 * SR+0x12c != 0 (국가대항전)  → 0xf3
 * 정규시즌: 경기수 짝수 && phase ∈ {1,3} → 0xc9, 그 밖 → 0xd8
 * 포스트시즌: SR+0xb2 != 0 → 0xef ; phase 0xc → 0xeb | 0xd → 0xec | 0xe → 0xed | 그 밖 → 0xef
 * ```
 *
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 * ⚠️ **사용자 판단 대기 — 국가대항전 플래그(`record.nationalCup` = `S+0x12c`)**
 *
 * 원본 시즌모드에는 이 플래그를 **0 으로 되돌리는 코드가 하나도 없다**
 * (S6 1절 확정: `0x12c` 를 만드는 코드 모양이 하나뿐이라 쓰기 15곳을 전수 확인했다.
 *  내리는 줄은 나리 쪽 `0x1b92c`·`0x1b768` 에만 있다 — 복붙 누락형 원본 버그).
 *
 * 그래서 아래 `nationalCup` 가지를 원본대로 두면, 대회가 한 번 열린 뒤부터는
 * **정규 경기가 끝날 때마다 여기서 국가대항전 대진표(0xf3)로 새고 시즌 진행이 막힌다.**
 * 목록 화면의 뒤로가기(`0x83cc` 의 −16 키)도 같은 플래그를 보고 215 대신 244 로 간다.
 *
 * **여기 한 줄을 넣으면 풀린다** — 대회가 끝나는 자리, 즉
 * `seasonRecord.ts` 의 `startNextYear`(원본 `0x6e0c`) 에
 * `nationalCup: false` 한 줄을 더하면 된다. (나리 `0x1b92c` 가 하는 일과 같다.)
 * `clearNationalCup()` 를 그 한 줄로 쓰라고 아래에 만들어 두었다 — **지금은 아무도 부르지 않는다.**
 *
 * DECISIONS.md 2026-09-20 항목에 "사용자 판단 대기" 로 올라가 있어 임의로 고치지 않았다.
 * 다만 웹판엔 국가대항전 자체가 아직 없으므로 지금 당장 막히는 것은 없다.
 * ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
 *
 * (참고: S6 1-4 는 같은 함수를 줄여 적으면서 `phase 6·7 → 0xee` 로 옮겼지만,
 *  phase 6 을 세우는 자리가 엔딩 경로(`0x6e0c`)라 **P4 1a 의 `→ 0xf5`(엔딩)** 를 따랐다.)
 */
export function enterSeasonScene(record: SeasonRecord, input: SceneEntryInput): SeasonSceneState {
  if (!input.hasSeasonSave) return SEASON_SCENE_STATE.팀고르기
  if (input.forceManagementMenu === true) return SEASON_SCENE_STATE.관리메뉴

  const phase = record.phase
  if (phase === SEASON_PHASE.엔딩 || phase === 7) return SEASON_SCENE_STATE.엔딩
  if (phase === SEASON_PHASE.경기끝) return SEASON_SCENE_STATE.관중수입
  if (phase === SEASON_PHASE.포스트시즌시작) return SEASON_SCENE_STATE.포스트시즌시작
  if (phase === SEASON_PHASE.정규시즌순위) return SEASON_SCENE_STATE.정규시즌순위

  // ⚠️ 원본 버그 그대로 — 위 큰 주석 참고. 이 플래그는 시즌모드에서 내려가지 않는다.
  if (record.nationalCup) return SEASON_SCENE_STATE.국가대항전

  if (!record.inPostseason) {
    const openManagement = record.games % MANAGEMENT_CYCLE === 0
    return openManagement && (phase === SEASON_PHASE.새시즌 || phase === SEASON_PHASE.기본)
      ? SEASON_SCENE_STATE.관리메뉴
      : SEASON_SCENE_STATE.다음경기
  }

  if (record.games !== 0) return SEASON_SCENE_STATE.시즌결산
  if (phase === SEASON_PHASE.타자시상) return SEASON_SCENE_STATE.타자시상
  if (phase === SEASON_PHASE.투수시상) return SEASON_SCENE_STATE.투수시상
  if (phase === SEASON_PHASE.최우수선수) return SEASON_SCENE_STATE.최우수선수
  return SEASON_SCENE_STATE.시즌결산
}

/**
 * ⚠️ **사용자 판단 대기**: 원본에 없는 한 줄이다.
 * 대회가 끝나는 자리(`startNextYear`)에서 이것을 부르면 위 버그가 풀린다.
 * **지금은 어디서도 부르지 않는다** — 원본과 같은 상태로 두었다.
 */
export function clearNationalCup(record: SeasonRecord): SeasonRecord {
  return { ...record, nationalCup: false }
}

/** 관리 메뉴 6칸 (점프표 `0xcbe40`, StrHOWTO[18]) */
export const MANAGEMENT_MENU = ['시즌정보', '구단관리', '트레이닝', '외출', '아이템', '다음경기'] as const
export type ManagementMenuItem = (typeof MANAGEMENT_MENU)[number]

export function managementMenuTarget(index: number): SeasonSceneState | null {
  const targets: readonly SeasonSceneState[] = [
    SEASON_SCENE_STATE.시즌정보,
    SEASON_SCENE_STATE.구단관리,
    SEASON_SCENE_STATE.트레이닝,
    SEASON_SCENE_STATE.외출지도,
    SEASON_SCENE_STATE.아이템,
    SEASON_SCENE_STATE.다음경기,
  ]
  return targets[index] ?? null
}

/** 구단관리 하위 4칸 (키 `0x4e40`) */
export const TEAM_MENU = ['구장관리', '트레이드', '선수영입', '코치채용'] as const

export function teamMenuTarget(index: number): SeasonSceneState | null {
  const targets: readonly SeasonSceneState[] = [
    SEASON_SCENE_STATE.구장관리,
    SEASON_SCENE_STATE.트레이드,
    SEASON_SCENE_STATE.선수영입,
    SEASON_SCENE_STATE.선수단, // 코치채용은 선수단 화면을 this+0x11c = 2 로 띄운다
  ]
  return targets[index] ?? null
}

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
