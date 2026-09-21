/**
 * 시즌모드(원본 게임 모드 2, 장면 0x105) 화면들의 공개 API.
 *
 * 앱(`src/app`)은 이 배럴만 import 한다. 화면은 모두 `RawScreen`(240×320) 한 장을 통째로 쓰고,
 * 상태는 하나도 들고 있지 않다 — 레코드를 받고 바뀐 레코드·고른 칸을 콜백으로 돌려준다.
 *
 * 상태 기계(어느 화면 다음에 무엇이 오는지)는 `entities/season-mode/model/seasonStateMachine.ts`
 * 의 `enterSeasonScene` · `managementMenuTarget` · `teamMenuTarget` · `afterGameNext` 가 가진다.
 */
export { SeasonManagementScreen } from '@/pages/season/ui/SeasonManagementScreen'
export type { SeasonManagementScreenProps } from '@/pages/season/ui/SeasonManagementScreen'

export { SeasonTeamMenuScreen } from '@/pages/season/ui/SeasonTeamMenuScreen'
export type { SeasonTeamMenuScreenProps, TeamMenuItem } from '@/pages/season/ui/SeasonTeamMenuScreen'

export { StadiumShopScreen } from '@/pages/season/ui/StadiumShopScreen'
export type { StadiumShopScreenProps } from '@/pages/season/ui/StadiumShopScreen'

export { PlayerRecruitScreen } from '@/pages/season/ui/PlayerRecruitScreen'
export type { PlayerRecruitScreenProps } from '@/pages/season/ui/PlayerRecruitScreen'

export { SeasonGoalsScreen } from '@/pages/season/ui/SeasonGoalsScreen'
export type { SeasonGoalsScreenProps } from '@/pages/season/ui/SeasonGoalsScreen'

export { GameIncomeScreen } from '@/pages/season/ui/GameIncomeScreen'
export type { GameIncomeScreenProps } from '@/pages/season/ui/GameIncomeScreen'

export { SeasonTrainingScreen } from '@/pages/season/ui/SeasonTrainingScreen'
export type { SeasonTrainingScreenProps } from '@/pages/season/ui/SeasonTrainingScreen'

export { SeasonOutingScreen } from '@/pages/season/ui/SeasonOutingScreen'
export type { SeasonOutingScreenProps } from '@/pages/season/ui/SeasonOutingScreen'

export { SeasonItemMenuScreen } from '@/pages/season/ui/SeasonItemMenuScreen'
export type { SeasonItemMenuScreenProps } from '@/pages/season/ui/SeasonItemMenuScreen'

/**
 * ── 시즌 끝 화면들 (정규시즌 45경기 뒤 0xe9 → 0xee → 0xeb → 0xec → 0xed → 0xf0 → 0xef → … → 0xf5)
 *
 * | 원본 상태 | 화면 |
 * |---|---|
 * | 0xee 포스트시즌 시작 | `PostseasonStartScreen` |
 * | 0xeb 타자시상 | `SeasonTitleAwardScreen` (`role="타자"`) |
 * | 0xec 투수시상 | `SeasonTitleAwardScreen` (`role="투수"`) |
 * | 0xed 최우수선수 | `SeasonMvpScreen` |
 * | 0xf0 정규시즌 순위 | `RegularSeasonRankScreen` |
 * | 0xef 시즌 결산 | `SeasonSummaryScreen` |
 * | 0xf5 엔딩 | `SeasonEndingScreen` |
 *
 * 단계 차례와 각 단계가 트는 이벤트는 `entities/season-mode` 의 `SEASON_END_CHAIN` 이 가진다.
 */
export { PostseasonStartScreen } from '@/pages/season/ui/PostseasonStartScreen'
export type { PostseasonStartScreenProps } from '@/pages/season/ui/PostseasonStartScreen'

export { SeasonTitleAwardScreen } from '@/pages/season/ui/SeasonTitleAwardScreen'
export type { SeasonTitleAwardScreenProps } from '@/pages/season/ui/SeasonTitleAwardScreen'

export { SeasonMvpScreen } from '@/pages/season/ui/SeasonMvpScreen'
export type { SeasonMvpScreenProps } from '@/pages/season/ui/SeasonMvpScreen'

export { RegularSeasonRankScreen } from '@/pages/season/ui/RegularSeasonRankScreen'
export type { RegularSeasonRankScreenProps } from '@/pages/season/ui/RegularSeasonRankScreen'

export { SeasonSummaryScreen } from '@/pages/season/ui/SeasonSummaryScreen'
export type { SeasonSummaryScreenProps } from '@/pages/season/ui/SeasonSummaryScreen'

export { SeasonEndingScreen } from '@/pages/season/ui/SeasonEndingScreen'
export type { SeasonEndingScreenProps } from '@/pages/season/ui/SeasonEndingScreen'

/** 포스트시즌 대진표 0x853ac (P6 4a-1 확정) — 시즌 끝 화면 둘이 함께 쓴다 */
export { PostseasonBracketWindow } from '@/widgets/season/ui/PostseasonBracketWindow'
export type { PostseasonBracketWindowProps } from '@/widgets/season/ui/PostseasonBracketWindow'

/** 시즌모드 전용 시상 이벤트 번호·보상 (P4 2a 확정) — ⚠️ 나리(371+개수·376/377)와 다르다 */
export {
  SEASON_AWARD_INTRO_EVENT_ID, SEASON_AWARD_REWARDS, SEASON_MVP_LEADER_KINDS,
  SEASON_MVP_RESULT_EVENT_ID, SEASON_PITCHER_TITLE_KINDS, SEASON_TITLE_RESULT_EVENT_ID,
  seasonAwardRewardOf, seasonMvpResultEventId, seasonTitleResultEventId,
} from '@/widgets/season/lib/seasonAwardEvents'
export type { SeasonAwardReward, SeasonAwardRole } from '@/widgets/season/lib/seasonAwardEvents'

/** 트레이닝 칸·가드·굴림 표 (J 4-6) — 굴림·적용은 부르는 쪽이 한다 */
export {
  TEAM_ABILITY_LABELS, TRAINING_SLOTS, HELL_TRAINING_INDEX, HELL_TRAINING_GAME_POINT,
  TRAINING_GUARD_CEILING, TRAINING_GAIN_RANGE, TRAINING_MORALE_LOSS_RANGE,
  HELL_TRAINING_GAIN_RANGE, HELL_TRAINING_MORALE_LOSS_RANGE,
  TRAINING_SUB_ITEM_GAIN, MASSAGER_MORALE_RELIEF, checkSeasonTraining,
} from '@/widgets/season/lib/seasonTraining'
export type {
  TrainingSlot, TrainingRefusal, TrainingCheckInput, TrainingCheckResult,
} from '@/widgets/season/lib/seasonTraining'

/** 시즌 외출 5종의 표·가드 (P4 3절) — ⚠️ 나리 외출표와 섞어 쓰면 안 된다 */
export {
  SEASON_OUTING_PLACES, SEASON_OUTING_ACTIVITIES, SEASON_OUTING_COSTS,
  SEASON_OUTING_REQUIRED_POPULARITY, SEASON_OUTING_EFFECTS, SEASON_OUTING_SUB_ITEMS,
  checkSeasonOuting,
} from '@/widgets/season/lib/seasonOuting'
export type {
  SeasonOutingPlace, SeasonOutingRefusal, SeasonOutingEffect, SeasonOutingCheckResult,
} from '@/widgets/season/lib/seasonOuting'

/** 아이템 메뉴 칸과 아이템 창 종류 `[win+0x1a4]` */
export { SEASON_ITEM_MENU, ITEM_WINDOW_KIND } from '@/widgets/season/lib/seasonItemMenu'
export type { SeasonItemMenuEntry, ItemWindowKind } from '@/widgets/season/lib/seasonItemMenu'

/** 영입 목록을 만들 때 쓰는 입력 타입 (`widgets/season` 이 가진다) */
export type {
  RecruitCandidate, RecruitListInput,
} from '@/widgets/season/lib/recruitList'
export {
  HALL_OF_FAME_BATTER_SLOTS, HALL_OF_FAME_PITCHER_SLOTS,
} from '@/widgets/season/lib/recruitList'
