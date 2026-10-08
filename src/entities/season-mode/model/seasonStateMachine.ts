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
  /** 시즌정보 하위 메뉴 4칸 (들어옴 0x4d58 · 키 0x9008 · 그리기 공통 틀 0x9fd8 → 0x9f60) — `seasonInfoMenu.ts` */
  시즌정보: 0xcd,
  /** 시즌정보 칸 0 구단정보 (갱신 0x53f8 → 0x5324 · 키 0x4884 · 그리기 0xae68) — 키는 취소(−16) → 0xcd 하나뿐 */
  구단정보: 0xd5,
  /** 시즌정보 칸 1 아이템 (갱신 0x5ee4 · 키 0x5f10 · 그리기 0xb1b4 = 상태판 + 커맨드 줄 + 아이템 창 0x8453c) */
  보유아이템: 0xd6,
  /** 시즌정보 칸 3 기록순위 창(팝업 0x80, 그리기 0xf334 · 키 0xf5d4)에서 확인 → 기록 목록 (갱신 0x56fc · 키 0x74c4 → 0xcd) */
  기록순위: 0xdb,
  /** 선수 기본정보 카드 (갱신 0x5404 · 키 0x48a0 · 그리기 0xae98) — 선수 고르기 0xdf 목적 2 에서 확인 */
  선수상세: 0xd9,
  /** 능력치 상세 창 (갱신 0x52f4 → 글 0x897e8 · 키 0x9398 · 그리기 0xaf8c = 0xae98 + 창 0x8a0a4) — 카드에서 '0' */
  능력치상세: 0xda,
  구단관리: 0xce,
  트레이닝: 0xcf,
  아이템: 0xd0,
  아이템상점: 0xdc,
  외출지도: 0xd1,
  /**
   * 외출 연출 (진입 0x5184 · 키 0x4944 · 갱신 0xce0c · 그리기 0xa06c) — 지도의 확인 팝업 0x16 에 "예"(0x4a94).
   * 연출이 끝나면 결과 0xc81c 가 굴리고 결과 팝업 0x17 을 띄우며, 팝업을 닫으면 0xc9
   */
  외출연출: 0xe3,
  이벤트재생: 0xd3,
  /** 선수단 — `this+0x11c` 1 경기 전 마선수 고르기 · 2 코치채용 (`preGameFlow.ts`) */
  선수단: 0xd7,
  다음경기: 0xd8,
  /** 경기 직전 경기정보 (들어옴 0x6548 · 키 0x83cc) — 확인하면 0xe1 로 */
  경기정보: 0xdd,
  /**
   * 엔트리 편집 (갱신 0x63dc · 키 0x7044 · 그림 0xb074) — 경기정보에서 '4'/왼(유저 팀, this+0x120 = 1)·
   * '6'/오른(CPU 팀, 0)으로 들어오고, 편집기 끝 코드로 0xdd 에 돌아간다 (`entryEditor.ts` · `seasonEntry.ts`)
   */
  엔트리편집: 0xe0,
  /**
   * 경기 장면 0x104 로 넘기는 전환 0xe1 (세 표 모두 빈 칸, 0xedb6 나무의 0xa1d0 만).
   * 웹은 이 장면이 곧 팀 경기 화면이다.
   */
  경기직전: 0xe1,
  구장관리: 0xea,
  /** 십전대보탕 투수 고르기 (들어옴 0x5870 · 키 0x7c00 · 결과 0x6f8c) — GP 상점 칸 3 의 "예" (0x7d90 0x8012) */
  스태미나회복: 0xe8,
  트레이드: 0xe4,
  /** 트레이드 하위 세 칸 (P4 1a 표 — 영입 선수 [163] · 보상 선수 [164] · 확인·진행 [171]).
   *  웹은 원본처럼 한 장면 객체가 단계를 들고 있어(`TradeScreen`) 라우팅은 0xe4 하나만 쓴다 */
  트레이드영입선수: 0xe5,
  트레이드보상선수: 0xe6,
  트레이드확인: 0xe7,
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
 * 국가대항전 플래그(`record.nationalCup` = `SR+0x12c`)는 대회 시작(상태 242 `0xe600`)에 서고
 * 대회 끝 `0x896c` → 새 해 `0x6e0c` 의 리그 초기화 memset(`0xa305c` → `0xb7b34`)에서 내려간다
 * (`seasonRecord.startNextYear` 주석). 그래서 이 가지는 **대회가 진행 중일 때 저장에서 이어 들어온 경우**에만 탄다.
 * ⚠️ S6 1절·DECISIONS 2026-09-20 의 "내리는 코드가 없다(시즌이 막히는 원본 버그)" 는 그 memset 을 놓친 결론이다.
 * 덧붙여 경기 끝 `0x4ea0c` 도 이 플래그가 서 있으면 phase 2 를 쓰지 않는다(4f1ba~4f1ca: L+0x34·L+0xac 둘 다 0 일 때만).
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
 * **관리 메뉴(this+0x70)·구단관리(this+0x78) 메뉴 커서** — 두 메뉴 객체는 장면 초기화 0x3b14 가 만들어 장면이 사는 동안
 * 남는다. 그래서 상태를 오가도 커서가 이어지고, 들어올 때 지우는 갈래만 0 으로 되돌린다 (직접 떴다).
 */
export interface SeasonMenuCursors {
  /** this+0x70 관리 메뉴 6칸 */
  readonly management: number
  /** this+0x78 구단관리 4칸 */
  readonly teamMenu: number
  /** this+0x74 시즌정보 4칸 (0x3b14 가 `0x6c219(메뉴, 4, 1, 1)` 로 만든다) */
  readonly seasonInfo: number
  /** this+0x88 아이템 하위 메뉴 4칸 (0x3b14 0x3c1a~ 가 만든다) */
  readonly itemMenu: number
}

/** 장면 생성 — 0x6c219 로 만든 메뉴는 커서 (0,0) */
export const INITIAL_SEASON_MENU_CURSORS: SeasonMenuCursors = { management: 0, teamMenu: 0, seasonInfo: 0, itemMenu: 0 }

/**
 * CPU 트레이드 요청 [203] 에 "예" (0x73b8 7440~7484) — 두 메뉴 커서를 칸 1(관리 메뉴 구단관리 · 구단관리 트레이드)에 둔다:
 * `[this+0x70|0x78] +0xc = 1 % 열수 · +0x10 = 1 / 열수` (한 열 메뉴라 곧 줄 1).
 */
export const TRADE_REQUEST_MENU_CURSOR = 1

/**
 * 상태에 들어올 때 메뉴 커서를 지우는 갈래 — `previous` 는 이전 상태 this+0x24.
 * ```
 * 0x4efc (0xc9 진입)  SR+4 ≠ 0 이고 이전 ∉ {0xd8, 0xce, 0xd0} → 관리 메뉴 커서 (0,0) · 스크롤 0
 *                     SR+0x1bc ≠ 0                         → 관리 메뉴 커서 (0,0) · 스크롤 0
 * 0x47d8 (0xce 진입)  이전 == 0xc9                          → 구단관리 커서 (0,0) · 스크롤 0
 * 0x4d58 (0xcd 진입)  이전 == 0xc9                          → 시즌정보 커서 (0,0) · 스크롤 0 (메뉴 vt+0x14(0,0) · +0x2c/+0x30 = 0)
 * 0x4d04 (0xd0 진입)  이전 == 0xc9                          → 아이템 메뉴 커서 (0,0) · 스크롤 0 — 상점·선수 고르기에서 돌아오면 남는다
 * ```
 * 곧 관리 메뉴에서 구단관리로 들어가면 늘 맨 위에서 시작하고, 트레이드·영입 같은 하위 화면에서 돌아오면 자리가 남는다.
 */
export function menuCursorsOnEnter(
  cursors: SeasonMenuCursors,
  entered: SeasonSceneState,
  previous: SeasonSceneState,
  record: Pick<SeasonRecord, 'acted' | 'endingSeen'>,
): SeasonMenuCursors {
  if (entered === SEASON_SCENE_STATE.관리메뉴) {
    const keeps = previous === SEASON_SCENE_STATE.다음경기
      || previous === SEASON_SCENE_STATE.구단관리
      || previous === SEASON_SCENE_STATE.아이템
    if ((record.acted && !keeps) || record.endingSeen) return { ...cursors, management: 0 }
    return cursors
  }
  if (entered === SEASON_SCENE_STATE.구단관리 && previous === SEASON_SCENE_STATE.관리메뉴) {
    return { ...cursors, teamMenu: 0 }
  }
  if (entered === SEASON_SCENE_STATE.시즌정보 && previous === SEASON_SCENE_STATE.관리메뉴) {
    return { ...cursors, seasonInfo: 0 }
  }
  if (entered === SEASON_SCENE_STATE.아이템 && previous === SEASON_SCENE_STATE.관리메뉴) {
    return { ...cursors, itemMenu: 0 }
  }
  return cursors
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
