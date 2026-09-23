/**
 * **일반모드(원본 게임 모드 1)** 의 공개 API.
 *
 * 앱(`src/app`)은 이 배럴만 import 한다. 한 판을 통째로 돌리려면 `GeneralModeScreen` 하나면 된다:
 *
 * ```tsx
 * <GeneralModeScreen
 *   random={random}
 *   isQuickStart={빠른실행으로_들어왔는가}
 *   openedHiddenTeamIds={전역기록_0x70}   // 히든 팀 10~14 중 열린 것
 *   openedAcePitcherIds={저장_0x30}       // 마투수 0~4 — 저장에 아직 없으면 DEFAULT_OPENED_ACE_PITCHER_IDS
 *   openedAceBatterIds={저장_0x35}        // 마타자 0~4 — 저장에 아직 없으면 DEFAULT_OPENED_ACE_BATTER_IDS
 *   onFinish={(summary) => …}             // 경기 끝
 *   onExit={() => 메인메뉴로()}            // 준비 첫 화면에서 CLR · 경기 중 나가기
 * />
 * ```
 *
 * 원본 흐름 (메인 메뉴 장면 0x103 하위 상태, P6 1-2 · StrHOWTO[6]):
 * `18 유저 팀 → 19 AI 팀 → 20 선공/구장 → 21 마선수 → 22 경기정보 → 경기 장면 0x104`.
 * 빠른실행(J-2)이면 22 로 바로 들어간다.
 *
 * 화면을 따로 쓰고 싶으면 준비 화면 세 장과 상태 고리를 그대로 꺼내 쓸 수 있다.
 */
export { GeneralModeScreen } from '@/pages/general-mode/ui/GeneralModeScreen'
export type { GeneralModeScreenProps } from '@/pages/general-mode/ui/GeneralModeScreen'

export { FirstBatStadiumScreen } from '@/pages/general-mode/ui/FirstBatStadiumScreen'
export type { FirstBatStadiumScreenProps, StadiumEntry } from '@/pages/general-mode/ui/FirstBatStadiumScreen'

export { AceSelectScreen } from '@/pages/general-mode/ui/AceSelectScreen'
export type { AceSelectScreenProps } from '@/pages/general-mode/ui/AceSelectScreen'

export { MatchInfoScreen } from '@/pages/general-mode/ui/MatchInfoScreen'
export type { MatchInfoScreenProps } from '@/pages/general-mode/ui/MatchInfoScreen'

export { MatchSettingsWindow } from '@/pages/general-mode/ui/MatchSettingsWindow'
export type { MatchSettingsWindowProps } from '@/pages/general-mode/ui/MatchSettingsWindow'

export { useGeneralMode } from '@/pages/general-mode/model/useGeneralMode'
export type { GeneralModeSession, UseGeneralModeOptions } from '@/pages/general-mode/model/useGeneralMode'

/**
 * 마선수 오픈 플래그 저장 칸 (`mgr[0x30..0x39]`) — 앱이 저장소만 꽂아 주면 된다.
 * 오픈 값은 `aceOpenPriceOf` 로 꺼내 G 에서 뺀다.
 */
export { useAceOpen } from '@/pages/general-mode/model/useAceOpen'
export type { AceOpenSession } from '@/pages/general-mode/model/useAceOpen'
export {
  ACE_OPEN_CELL_COUNT, ACE_OPEN_SHORTAGE_POPUP, INITIAL_ACE_OPEN_SAVE,
  aceBatterIdsOf, aceOpenAnswerOf, aceOpenPriceOf, acePitcherIdsOf,
  isAceCellOpen, normalizeAceOpenSave, openAceCell,
} from '@/pages/general-mode/lib/aceOpenState'
export type { AceOpenAnswer, AceOpenSave } from '@/pages/general-mode/lib/aceOpenState'

/** 준비 기록(skin+0xbc)과 단계 번호 — 저장에 적거나 화면을 따로 몰 때 쓴다 */
export {
  ACE_PER_ROLE, ACE_PHASE, DEFAULT_OPENED_ACE_BATTER_IDS, DEFAULT_OPENED_ACE_PITCHER_IDS,
  FIRST_BAT_PHASE, GENERAL_MODE_STEP, INITIAL_SETUP, NO_ACE, STADIUM_COUNT,
  aceIndexOfCell, aceRoleOfCell, teamGameOptionsOf,
} from '@/pages/general-mode/lib/generalModeSetup'
export type {
  AcePhase, FirstBatPhase, GeneralModeSetup, GeneralModeStep,
} from '@/pages/general-mode/lib/generalModeSetup'

/** 준비 흐름(18~22) 의 순수 함수 — 화면 없이도 단계를 몰 수 있다 */
export {
  chooseAce, chooseAiTeam, chooseFirstBat, chooseStadium, chooseUserTeam, createFlowState,
  moveFirstBat, moveStadium, stepBack, withSetup,
} from '@/pages/general-mode/lib/generalModeFlow'
export type { GeneralModeFlowState } from '@/pages/general-mode/lib/generalModeFlow'

/** 빠른실행 무작위 (J-2 확정) */
export { QUICK_RESPIN_TICKS, quickStartTeamCandidates, rollQuickStart } from '@/pages/general-mode/lib/quickStart'
export type { QuickStartOpenState } from '@/pages/general-mode/lib/quickStart'

/**
 * 히든 팀 잠금 규칙 — **일반모드에서만 고를 수 있다**(StrMODE[1]).
 * 다른 모드의 팀 고르기가 이 규칙을 쓰고 싶으면 여기서 꺼내 쓰면 된다.
 */
export {
  HIDDEN_TEAM_COUNT, HIDDEN_TEAM_FIRST_ID, canSelectTeam, canUseHiddenTeams,
  hiddenTeamHintMessage, isHiddenTeam, isTeamOpened,
} from '@/pages/general-mode/lib/hiddenTeam'

/** 경기정보 다섯 줄의 값 (R4 2d) */
export { generalModeMatchInfoLines } from '@/pages/general-mode/lib/matchInfoLines'
export type { MatchInfoLine } from '@/pages/general-mode/lib/matchInfoLines'
