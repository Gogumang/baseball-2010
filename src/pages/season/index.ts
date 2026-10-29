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

export { SeasonTeamMenuScreen } from '@/pages/season/ui/SeasonTeamMenuScreen'

export { StadiumShopScreen } from '@/pages/season/ui/StadiumShopScreen'
export { INITIAL_STADIUM_PREVIEW_SCENE } from '@/pages/season/lib/stadiumPreviewScene'

export { PlayerRecruitScreen } from '@/pages/season/ui/PlayerRecruitScreen'

/** 트레이드 네 칸 0xe4 → 0xe5 → 0xe6 → 0xe7 (J 4-4) */
export { TradeScreen } from '@/pages/season/ui/TradeScreen'

/** 코치채용 — 선수단 화면 0xd7 을 `this+0x11c = 2` 로 띄운 것 (J 4-3) */
export { CoachHireScreen } from '@/pages/season/ui/CoachHireScreen'

/** 시즌정보 0xcd — 네 칸 하위 메뉴 (키 0x9008) */
export { SeasonInfoScreen } from '@/pages/season/ui/SeasonInfoScreen'

/** 시즌정보 칸 0 구단정보 0xd5 — 카드 0x7ba44 팀 갈래 + 정보 칸 0x7c450 */
export { SeasonTeamInfoScreen } from '@/pages/season/ui/SeasonTeamInfoScreen'
export { FRESH_SEASON_INFO_RECORD, seasonNameInfoRowsOf, seasonTeamInfoRowsOf } from '@/pages/season/lib/seasonTeamInfo'

/** 시즌정보 칸 1 아이템 0xd6 — 아이템 창 종류 5 (보유 서브아이템 보기) */
export { SeasonOwnedItemsScreen } from '@/pages/season/ui/SeasonOwnedItemsScreen'

/** 시즌정보 칸 3 기록순위 — 창 0x80(타자기록·투수기록) → 0xdb 리그 개인 순위표(0x5796c) */
export { SeasonRecordPickPopup, SeasonRecordRankScreen } from '@/pages/season/ui/SeasonRecordRankScreen'

/** 장비 창 0xdc (종류 3) — 아이템 → 장착아이템 → 선수 고르기 0xdf 목적 1 → 확인 */
export { SeasonEquipmentScreen } from '@/pages/season/ui/SeasonEquipmentScreen'

/** 공용 선수 고르기 0xdf (목적 1·2) → 선수 카드 0xd9 ↔ 능력치 상세 창 0xda (글 0x897e8) */
export { SeasonPlayerPickScreen } from '@/pages/season/ui/SeasonPlayerPickScreen'
export { SeasonPlayerCardScreen } from '@/pages/season/ui/SeasonPlayerCardScreen'
export { seasonCardAbilitiesOf, seasonCardInfoOf, seasonPlayerDetailViewOf } from '@/pages/season/lib/seasonPlayerDetail'

/** 경기 뒤 마무리 0xf1 — 같은 날 다른 네 경기 결과판 (그림 0xb400) */
export { DayResultBoardScreen } from '@/pages/season/ui/DayResultBoardScreen'

export { GameIncomeScreen } from '@/pages/season/ui/GameIncomeScreen'

export { SeasonTrainingScreen } from '@/pages/season/ui/SeasonTrainingScreen'

export { SeasonOutingScreen } from '@/pages/season/ui/SeasonOutingScreen'

export { SeasonItemMenuScreen } from '@/pages/season/ui/SeasonItemMenuScreen'

/**
 * ── 시즌 끝 화면들 (정규시즌 45경기 뒤 0xe9 → 0xee → 0xeb → 0xec → 0xed → 0xf0 → 0xef → … → 0xf5)
 *
 * | 원본 상태 | 화면 |
 * |---|---|
 * | 0xee 포스트시즌 시작 | `SeasonChainFrameScreen`(가운데 판 없음) 한 틀 → 이벤트 392 (0xd3) |
 * | 0xeb 타자시상 | `SeasonChainFrameScreen` 한 틀 → 이벤트 370 → 372/373 (0xd3) |
 * | 0xec 투수시상 | `SeasonChainFrameScreen` 한 틀 → 이벤트 371 → 374/375 (0xd3) |
 * | 0xed 최우수선수 | `SeasonChainFrameScreen` 한 틀 → 이벤트 376 → 378/379 (0xd3) |
 * | 0xf0 정규시즌 순위 | `SeasonChainFrameScreen` 한 틀 → 이벤트 401~403 (0xd3) |
 * | 0xef 시즌 결산 | `SeasonSummaryScreen` |
 * | 0xf5 엔딩 | `SeasonEndingScreen` |
 *
 * 단계 차례와 각 단계가 트는 이벤트는 `entities/season-mode` 의 `SEASON_END_CHAIN` 이 가진다.
 */

export { SeasonChainFrameScreen } from '@/pages/season/ui/SeasonChainFrameScreen'

export { SeasonSummaryScreen } from '@/pages/season/ui/SeasonSummaryScreen'

export { SeasonEndingScreen } from '@/pages/season/ui/SeasonEndingScreen'
export { SeasonScreenFade } from '@/pages/season/ui/SeasonScreenFade'

/** 영입 목록을 만들 때 쓰는 입력 타입 (`widgets/season` 이 가진다) */
export type { RecruitCandidate, RecruitListInput } from '@/widgets/season/lib/recruitList'

/** 다음경기 0xd8 — 순위표 한 장 (그림 0xae24 · 키 0x48d0) */
export { NextGameScreen } from '@/pages/season/ui/NextGameScreen'

/** 경기 직전 경기정보 0xdd — 공용 목록 k 4 + 시즌 값 줄 (0x5dcc0 모드 2 갈래) */
export { SeasonMatchInfoScreen } from '@/pages/season/ui/SeasonMatchInfoScreen'
export { seasonMatchInfoLines } from '@/pages/season/lib/seasonMatchInfo'

/** 아이템 상점 0xdc 종류 1 서브아이템 · 2 GP (키 0x957c · 적용 0x7d90) · 십전대보탕 투수 고르기 0xe8 (0x7c00) */
export { SeasonItemShopScreen } from '@/pages/season/ui/SeasonItemShopScreen'
export { SeasonStaminaPickScreen } from '@/pages/season/ui/SeasonStaminaPickScreen'

/** 이벤트 재생 0xd3 의 밑그림 — 대화창 0x8b5ac 의 공 무늬 · 상태판 · 머리띠 */
export { SeasonEventEndFrame, SeasonEventUnderlay } from '@/pages/season/ui/SeasonEventUnderlay'
