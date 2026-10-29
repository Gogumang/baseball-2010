import { MANAGEMENT_CYCLE, type SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { SEASON_PHASE, SEASON_SCENE_STATE, type SeasonSceneState } from '@/entities/season-mode/model/seasonStateMachine/states'

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
  const byPhase = PHASE_ENTRY_STATES.get(record.phase)
  if (byPhase !== undefined) return byPhase
  if (record.nationalCup) return SEASON_SCENE_STATE.국가대항전
  return record.inPostseason ? postseasonEntryOf(record) : regularSeasonEntryOf(record)
}

/** phase 만 보고 곧장 가는 상태 — 6·7 엔딩 · 2 관중수입 · 0xb 포스트시즌 시작 · 0x10 정규시즌 순위 */
const PHASE_ENTRY_STATES: ReadonlyMap<number, SeasonSceneState> = new Map<number, SeasonSceneState>([
  [SEASON_PHASE.엔딩, SEASON_SCENE_STATE.엔딩],
  [7, SEASON_SCENE_STATE.엔딩],
  [SEASON_PHASE.경기끝, SEASON_SCENE_STATE.관중수입],
  [SEASON_PHASE.포스트시즌시작, SEASON_SCENE_STATE.포스트시즌시작],
  [SEASON_PHASE.정규시즌순위, SEASON_SCENE_STATE.정규시즌순위],
])

/** 포스트시즌 경기 수 0 일 때 phase → 시상 상태 (그 밖은 결산) */
const POSTSEASON_PHASE_STATES: ReadonlyMap<number, SeasonSceneState> = new Map<number, SeasonSceneState>([
  [SEASON_PHASE.타자시상, SEASON_SCENE_STATE.타자시상],
  [SEASON_PHASE.투수시상, SEASON_SCENE_STATE.투수시상],
  [SEASON_PHASE.최우수선수, SEASON_SCENE_STATE.최우수선수],
])

/** 정규시즌: 경기수 짝수 && phase ∈ {1,3} → 0xc9, 그 밖 → 0xd8 */
function regularSeasonEntryOf(record: SeasonRecord): SeasonSceneState {
  const openManagement = record.games % MANAGEMENT_CYCLE === 0
  const isManagementPhase = record.phase === SEASON_PHASE.새시즌 || record.phase === SEASON_PHASE.기본
  return openManagement && isManagementPhase ? SEASON_SCENE_STATE.관리메뉴 : SEASON_SCENE_STATE.다음경기
}

/** 포스트시즌: SR+0xb2 != 0 → 0xef ; phase 0xc → 0xeb | 0xd → 0xec | 0xe → 0xed | 그 밖 → 0xef */
function postseasonEntryOf(record: SeasonRecord): SeasonSceneState {
  if (record.games !== 0) return SEASON_SCENE_STATE.시즌결산
  return POSTSEASON_PHASE_STATES.get(record.phase) ?? SEASON_SCENE_STATE.시즌결산
}
