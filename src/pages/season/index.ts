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

/** 영입 목록을 만들 때 쓰는 입력 타입 (`widgets/season` 이 가진다) */
export type {
  RecruitCandidate, RecruitListInput,
} from '@/widgets/season/lib/recruitList'
export {
  HALL_OF_FAME_BATTER_SLOTS, HALL_OF_FAME_PITCHER_SLOTS,
} from '@/widgets/season/lib/recruitList'
