import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createMemoryAceMatchPendingPort } from '@/entities/mode-save/model/modeSave'
import type { AceMatchPendingPort } from '@/entities/mode-save/model/modeSave'
import { pitcherCollectorHiddenIdsOf } from '@/entities/collection/model/collection'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  applyPitcherGameResult,
  applyPitcherLeagueDay,
  applyPitcherPostseasonProgress,
  applyPitcherSeasonEnd,
  countCompleteGame,
  createPitcherCareer,
  gainPitcherMorale,
  gainPitcherPopularity,
  gainPitcherReputation,
  isPitcherManagementCycleOpen,
  isPitcherSeasonFinished,
  nextPitcherOpponentOf,
  spendPitcherCycleAction,
  pitcherLeagueGameSetupOf,
  prepareMyPitcherMatch,
  enterPitcherGameEvaluation,
  NO_LAST_EVALUATION,
  startNextPitcherSeason,
  withPitcherGameLeagueRecords,
  withPitcherGameStaminas,
} from '@/entities/pitcher-career/model/pitcherCareer'
import { isMyTurn } from '@/entities/league/model/seasonEnd'
import type { PitcherLastGame } from '@/entities/pitcher-career/model/pitcherCareer'
import { PITCHER_ROLE } from '@/entities/pitcher-career/model/pitcherRole'
import { reliefNeverEnteredOf } from '@/entities/pitcher-career/model/pitcherRotation'
import {
  advancePitcherStreaks,
  EMPTY_PITCHER_STREAKS,
  pitcherStreakEventOfCareer,
} from '@/entities/pitcher-career/model/pitcherStreaks'
import { managerCommentIndexOf } from '@/features/play-pitcher-game/model/pitcherGameEvaluation'
import { activeSound, playSoundIds } from '@/shared/api/audio/soundPort'
import {
  enterPitcherYearEndEvent,
  finishPitcherYearEndEvent,
  nextPitcherYearEndStep,
  PITCHER_POSTSEASON_STEP_ID,
  pitcherResumePointOf,
} from '@/entities/pitcher-career/model/pitcherYearEnd'
import type { PitcherResumePoint } from '@/entities/pitcher-career/model/pitcherYearEnd'
import { leagueDayCounterOf } from '@/entities/career/model/leagueGameSetup'
import {
  applyKoreanSeriesReward,
  applyRegularSeasonReward,
  popupAfterChampion,
  regularSeasonPopupOnEnter,
  REGULAR_SEASON_HIDDEN_ID,
} from '@/entities/career/model/postseasonFlow'
import type { PostseasonPopup, RegularSeasonOtherModes } from '@/entities/career/model/postseasonFlow'
import { applyPitcherEventRewards, finishPitcherEvent } from '@/entities/pitcher-career/model/pitcherEventReward'
import {
  PITCHER_YEAR_START_EVENT,
  PITCHER_YEAR_START_EVENT_ID,
  pitcherOpeningScanOf,
  pitcherPlaceEventOf,
  scanPitcherEventFrom,
} from '@/entities/pitcher-career/model/pitcherStoryScene'
import {
  EVENT_TRIGGER,
  markRewardedEvent,
  withOutingEventActed,
  nariSeasonEndStateOfResumeCode,
  rewardItemsResumeCodeOf,
  rewardResumePatchOf,
} from '@/entities/story/model/storyScene'
import { achievedPitcherGoalCount } from '@/entities/pitcher-career/model/pitcherYearGoals'
import {
  careerNationalCupRewardItems,
  careerNationalTeamEventId,
  isCareerNationalCupYear,
  NATIONAL_CUP_EVENT,
} from '@/entities/national-cup/model/nationalCupFlow'
import type { NationalCupFinish } from '@/entities/national-cup/model/nationalCupFlow'
import {
  KOREA_TEAM_ID,
  createNationalCup,
  nationalCupMatchupOf,
  nationalCupSideOf,
} from '@/entities/national-cup/model/nationalCup'
import type { NationalCup, NationalCupMatchup } from '@/entities/national-cup/model/nationalCup'
import { advanceNationalCupDay } from '@/entities/national-cup/model/nationalCupPlay'
import { nariCupRecordOf, nextNariCupDayTeams } from '@/entities/career/model/nariCupTeams'
import type { NariCupTeams } from '@/entities/career/model/nariCupTeams'
import { nariCupGameResultOf, settleNariCupGame } from '@/entities/career/model/nariCupGame'
import { liveGameInningIndex, resetLiveGameState, setLiveGameInningIndex } from '@/shared/lib/liveGameState/liveGameState'
import {
  createPitcherCupTeams,
  pitcherCupPositionCodeOf,
  preparePitcherCupMatch,
} from '@/entities/pitcher-career/model/pitcherCupTeams'
import { gameMyPitcherOrderOf } from '@/entities/pitcher-career/model/myPitcherRecord'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import type { PlayerSide } from '@/entities/game/model/gameState'
import {
  INJURY_ENDING_EVENT_ID,
  MID_SEASON_GAME,
  midSeasonEventId,
  midSeasonTitlesOf,
  NO_ENDING_JUDGEMENT,
  RETIREMENT_CHOICE_EVENT_ID,
  savedCareerOf,
  salaryOfferOf,
  SALARY_EVENT_ID,
} from '@/entities/career/model/seasonFlow'
import { emptyPlaceEventId, isEmptyPlaceEventId } from '@/entities/career/model/battingOrder'
import { EVENT_REWARD_KIND } from '@/entities/story/model/eventReward'
import type { EventReward } from '@/entities/story/model/eventReward'
import { aceMatchMissionOf, matchResultEventOf } from '@/entities/story/model/aceMatch'
import type { StoryCarry } from '@/entities/story/model/aceMatch'
import type { OriginalMission } from '@/shared/config/original/missions'
import type { EventCommand } from '@/shared/config/original/eventTypes'
import type { OriginalEvent } from '@/shared/config/original/eventTypes'
import { formatOriginalMoney } from '@/features/shop/model/shopSelection'
import { hiddenOpenTextOf } from '@/entities/career/model/equipment'
import { pitcherHiddenOpenTextOf } from '@/entities/pitcher-career/model/pitcherEquipment'
import {
  applyPitcherEndingBonus,
  canContinueAfterPitcherEnding,
  continueAfterPitcherEnding,
  judgePitcherEnding,
  PITCHER_CONTINUE_COST_GAME_POINT,
  pitcherEndingBonusOf,
  pitcherInjuryEndingOf,
} from '@/entities/pitcher-career/model/pitcherSeasonFlow'
import {
  awardPitcherTitles,
  nextPitcherTitleOf,
} from '@/entities/pitcher-career/model/pitcherTitles'
import type { PitcherRookieProfile } from '@/entities/pitcher-career/model/pitcherRegistration'
import {
  pitcherGameOptionsOf,
  pitcherGameOutcomeOf,
  teamMoraleOf,
} from '@/pages/pitcher-league/model/pitcherGameOptions'
import type { PitcherGameOptions, PitcherGameSummary } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { recordGamePointsOf } from '@/entities/game/model/gameRecords'
import {
  MAXIMUM_GAME_POINT, rebuildEquippedSkillIds,
} from '@/entities/career/model/playerCareer'
import { nationalCupStandingsTitleOf } from '@/entities/career/model/titles'
import { isInfiniteGamePointOn } from '@/shared/lib/dev/devOptions'
import type { GamePointWalletSession } from '@/entities/wallet/model/useGamePointWallet'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { selectPitcherShopItem } from '@/features/shop/model/pitcherShopSelection'
import { BATTER_GP_ITEMS } from '@/entities/career/model/gpItems'
import {
  leagueUsageOf, PITCHER_LEAGUE_MODE, skillEquipStatEventsOf,
} from '@/entities/collection/model/annalsStats'
import type { AnnalsStatEvent } from '@/entities/collection/model/annalsStats'
import type { GpDetailOf } from '@/features/shop/model/shopSelection'
import type { PitcherShopTab } from '@/features/shop/model/pitcherShopSelection'
import { outingBlockReasonOf, outingBlockTextOf, performOuting } from '@/entities/career/model/outing'
import type { OutingResult } from '@/entities/career/model/outing'
import { OUTING_PLACES } from '@/shared/config/outingPlaces'
import { EMPTY_OUTING_PLACE_SLOTS, outingPlaceSlotsOf, outingSlotPlaceIdsOf } from '@/pages/outing-map/lib/outingPlaceSlots'
import type { OutingPlace } from '@/shared/config/outingPlaces'
import { PITCHER_MANAGEMENT_TEXT } from '@/pages/pitcher-league/lib/pitcherManagementMenu'
import { nariMatchCancelTargetOf, rollNariMatchAces, rollNariMatchStadium } from '@/pages/management/lib/nariMatchPrepare'
import {
  nariTeamRecordOf, nariTeamsOf, recordMatchAcesOf, recordTeamAcesOf, seatNariMatchAces,
} from '@/entities/career/model/nariTeamRecord'
import { pointNariEntryCursor, pressNariEntryKey } from '@/pages/management/lib/nariEntryView'
import type { NariEntryView } from '@/pages/management/lib/nariEntryView'
import { pitcherNariEntryViewOf } from '@/pages/pitcher-league/lib/pitcherEntryView'
import type { EntryKey } from '@/entities/season-mode/model/entryEditor'
import type { NariGameMatch, NariGameSavePort, NariMatchAces, NariOpenedAces } from '@/pages/management/lib/nariMatchPrepare'
import { DEFAULT_OPENED_ACE_BATTER_IDS, DEFAULT_OPENED_ACE_PITCHER_IDS } from '@/pages/general-mode/lib/generalModeSetup'

/** 처음부터 열린 마선수 — 저장 +0x30 · +0x35 (`normalizeAceOpenSave` 가 늘 켠다) */
const DEFAULT_NARI_OPENED_ACES: NariOpenedAces = {
  pitcherIds: DEFAULT_OPENED_ACE_PITCHER_IDS,
  batterIds: DEFAULT_OPENED_ACE_BATTER_IDS,
}

/**
 * 나만의리그 **투수편**(원본 게임 모드 3, 장면 0x106) 한 판.
 *
 * 타자편 저장(`useCareerSession`)과 **다른 칸**을 쓴다 — 원본도 둘을 따로 두고
 * 환경설정 "모드 초기화" 가 각각 지운다 (StrMAINMENU[210]·[211]).
 */

/**
 * 화면 유니온 — 원본 장면 0x106 의 상태 번호를 괄호에 적는다.
 *   등록(101~104) · 관리(105) · 경기(144) · 시즌종료(136 자리) · 연말(132 — 502 갈림길 화면) · 엔딩(141) ·
 *   상점(111 장비 상점 / 121 장비착용 — 어느 쪽인지는 `shopTab`) · 외출(112 지도 · 113 장소) ·
 *   이벤트(114 이벤트 재생 — 무엇을 틀었는지는 `story`) · 포스트시즌(128 대진 — 팝업은 `postseasonPopup`)
 */
export type PitcherScene =
  | '등록' | '관리' | '경기' | '시즌종료' | '연말' | '엔딩' | '상점' | '외출' | '이벤트' | '마선수대결' | '포스트시즌'
  /** 다음경기 앞 순위표 (상태 109) — 타자편과 같은 진입 0x10d8c · 키 0x105f0 · 그림 0x168a4 */
  | '다음경기순위'
  /** 경기 준비(매치업, 상태 142) — 타자편과 같은 진입 0x1c46c · 키 0x13c30 · 그림 0x15d98 */
  | '경기준비'
  /** 경기 뒤 평가 (상태 116, 진입 0x1278c) — 타자편과 같은 상태. [확인] = 114 */
  | '경기결과'
  /** 국가대항전 대진 134 · 순위 135 (0x19f30 · 0x19fdc · 0x10680) — 타자편과 같은 상태 */
  | '국가대항전'

/**
 * 이벤트 재생(상태 114)을 **어디서** 틀었나 — 끝난 뒤 갈 곳(장면+0x24 "뒤 상태")이 이것으로 갈린다.
 *   관리     105 의 자동 발동(0x1cf9c — trigger 0 · 오프닝 451). 뒤 = 105
 *   연초     115 (0x16aac `[다음 114, 뒤 105]`) — 내장 이벤트 `PITCHER_YEAR_START_EVENT`
 *   지도     112 의 자동 발동(trigger 1). 뒤 = 112
 *   중간평가 117 (0x11e84 `[다음 114, 뒤 105]`) — 452~454
 *   연말     136 · 130 · 131 · 132 · 133 사슬 (392 → … → 380/502 → 461/462)
 *   장소     113 [들어가기] (0x16c64 `[다음 114, 뒤 113]`) — 끝 처리 0x1c014 가 빈 장소가 아니면 행동을 쓰고 105 로
 *   대결결과 140 (0x10df8 `[다음 114, 뒤 105]`) — 마선수 대결에서 돌아와 결과 이벤트
 */
export type PitcherStoryContext = '관리' | '연초' | '지도' | '중간평가' | '연말' | '장소' | '대결결과'

export interface PitcherStory {
  readonly eventId: number
  readonly context: PitcherStoryContext
  /** 연말 사슬에서 **앞서** 본 이벤트 번호 (이번 재생 것은 재생기가 넘긴다) */
  readonly viewed: readonly number[]
  /** 대결 결과 이벤트(140)면 대결 앞 이벤트가 모아 둔 보상·본 이벤트 — 재생기가 이어 받는다 */
  readonly carried?: StoryCarry
}

/**
 * 마선수 대결 (r_event `match` = SYS 8, 0x8d734) — 투수편은 `g[0x175] = team − 1` 로 **투수 미션 레코드**를 고르고
 * 미션 장면(모드 5)에서 사람이 던진다 (S13 4-1 · Q2 1b). 결과는 저장 +0x177 에 적고 장면 0x106 으로 돌아온다.
 */
export interface PitcherAceMatch {
  readonly mission: OriginalMission
  readonly resultEvents: readonly number[]
  readonly carried: StoryCarry
}

type MatchCommand = Extract<EventCommand, { op: 'match' }>

export interface PitcherLeagueSession {
  readonly career: PitcherCareer | null
  readonly scene: PitcherScene
  /** 109 순위표의 이전 상태가 105(관리)인가 — 바닥 5(되돌아가기) / 1 */
  readonly nextGameFromManagement: boolean
  /** 142 진입 0x1c46c 가 이 장면에서 굴린 마선수 — 경기정보 마투수·마타자 줄 */
  readonly matchAces: NariMatchAces | null
  /** 143 경기 전 엔트리 보기 — 142(`경기준비`) 위에 선다 */
  readonly entryView: NariEntryView | null
  /** 지금 경기를 세울 옵션. 경기 장면이 아니면 null */
  readonly gameOptions: PitcherGameOptions | null
  /** 상점 장면의 창 — '장착' 111 장비 상점 · '착용' 121 장비착용 */
  readonly shopTab: PitcherShopTab
  /** 상점에서 마지막으로 고른 칸의 결과 알림 (막힘·구매 완료·히든 오픈) */
  readonly shopNotice: string
  /** 상점 GP 결과 창 (0x872a1) — 칸 0~4·6 구매 뒤. 닫아도 굴림 없이 상점 그대로 (0x1d649) */
  readonly shopGpDetail: GpDetailOf<PitcherCareer> | null
  /** 외출 지도(112·113)에서 고른 장소 기능의 막힘 알림 (결과는 `outingResult` 팝업) */
  readonly outingNotice: string
  /** 126 효과 팝업(0x15234) 과 이어질 입원 회복 글(0x1575c) — 효과 팝업이 떠 있지 않으면 null */
  readonly outingResult: OutingResult | null
  /** 126 에서 105 로 돌아온 뒤 관리 화면 위에 남는 입원 회복 팝업 글 (0x1575c `0xbbef8(글, 1, 1, 1)`). 없으면 '' */
  readonly outingRecoveryNotice: string
  /** 지금 재생하는 이벤트 (장면 '이벤트'). 아니면 null */
  readonly story: PitcherStory | null
  /** r_event 본문 + 연초 115 내장 이벤트 — 커리어가 생긴 뒤 따로 불러온다(535KB 별도 묶음). 오기 전에는 null */
  readonly storyEvents: readonly OriginalEvent[] | null
  /** 외출 지도 [!] — 장소 이벤트 배정 0x8cdc0 이 이벤트를 넣은 장소 id */
  readonly eventPlaceIds: ReadonlySet<string>
  /** 이벤트 번호별 `%s` 글 — 380 연봉 제시액(0x8bc4c → 금액 서식 0x55cf4). 기본이면 undefined */
  readonly storyReplacementsFor: (eventId: number) => readonly string[] | undefined
  /** 128 대진 위 팝업 (0xb 정규시즌 우승 · 7 우승 팀 발표 · 8 한국시리즈 우승). 없으면 null */
  readonly postseasonPopup: PostseasonPopup | null
  /** 치르는 마선수 대결 (장면 '마선수대결'). 아니면 null */
  readonly aceMatch: PitcherAceMatch | null
  /** 이벤트 재생 뒤 띄울 알림 — 히든 오픈(보상 7) 팝업 글 · 옮기지 않은 갈래. 없으면 '' */
  readonly storyNotice: string
  /** 관리 화면에 띄울 칭호 팝업 하나 (0x1a1c0 → 0x1274c). 없으면 null */
  readonly pendingTitle: string | null
  /** 국가대항전 대회 (장면 '국가대항전') — `atStandings` 면 135(순위)부터 (142 취소). 대회 칸은 커리어 `nationalCup` 에도 저장된다 */
  readonly cup: { readonly cup: NationalCup; readonly atStandings: boolean } | null
  /** 국가대항전 142 경기 준비의 대진 (135 에서 왔을 때). 리그 경기면 null */
  readonly cupMatch: { readonly matchup: NationalCupMatchup; readonly cup: NationalCup } | null
  readonly actions: {
    /** 칭호 팝업 확인 0x1b1e4 — 비트·곧바로 장착·저장 */
    readonly confirmTitle: () => void
    readonly create: (name: string, profile: PitcherRookieProfile) => void
    /** 바뀐 커리어를 그대로 저장한다 (구질 훈련처럼 화면이 계산해 돌려줄 때) */
    readonly save: (career: PitcherCareer) => void
    readonly goto: (scene: PitcherScene) => void
    /** 경기 중 메뉴 "나가기"(상태 0x22 → 0x40140 → 장면 0x103) — 부르는 쪽이 메인 메뉴로 간다. 저장·+0x4f 는 그대로 */
    readonly quitGame: () => void
    readonly beginGame: () => void
    /** [14] 투수편·[최근게임](모드 3) 의 "곧장 경기" — 0x327b8 모드 3 갈래(+0x43 && +0x4f) → 0x213c0(앱, 3, 0) → 장면 0x104 */
    readonly resumeInterruptedGame: (match: NariGameMatch | null) => void
    /** 관리 [다음경기] → 109 순위표 (이전 상태 105) */
    readonly openNextGameStandings: () => void
    /** 109 확인(−5 · '5') → 142 경기 준비 */
    readonly confirmNextGameStandings: () => void
    /** 142 확인(−5 · '5') → 144 → 경기 */
    readonly confirmMatchPrepare: () => void
    /** 142 '4'/왼 · '6'/오른 → 143 (내 팀 · 상대 팀, 보기 전용) */
    readonly openEntryView: (isMyTeam: boolean) => void
    readonly pressEntryViewKey: (key: EntryKey) => void
    readonly pointEntryViewCursor: (index: number) => void
    /** 142 취소(−16) — 포스트시즌이면 128, 아니면 109 (0x13c72) */
    readonly cancelMatchPrepare: () => void
    /** 109 취소(−16) — 이전 상태가 105 일 때만 105 로 (0x1060e) */
    readonly cancelNextGameStandings: () => void
    readonly finishGame: (summary: PitcherGameSummary) => void
    /** 116 경기 뒤 평가 [확인] → 114 → 105/109/128/136 (116 의 끝 0x12b74) */
    readonly confirmGameResult: () => void
    /** 시즌 끝 화면 [다음] → 연말 사슬 136 → 130 → 131 → 132 (→ 133) 을 이벤트 392 부터 튼다 */
    readonly beginYearEnd: () => void
    /** 연말 502 "연봉 협상한다" → 이벤트 380 (연봉협상) */
    readonly continueCareer: () => void
    /** 연말 502 "은퇴한다" → 이벤트 496 (→ 503 → 엔딩 화면 141) */
    readonly retire: () => void
    /** 엔딩 141 의 팝업 0x32 — 5000 G포인트로 이어하기. 모자라면 false */
    readonly continueAfterEnding: () => boolean
    /** 엔딩 141 의 보너스 팝업 0x2b 를 닫았다 — 보너스 · S+0x7b = 1 · 저장 (1bbf4~1bc70) */
    readonly receiveEndingBonus: () => void
    /** 엔딩을 떠나 메인 메뉴로 — 명예의 전당에 등록했으면 선수 저장을 지운다(0x224ec), 아니면 저장이 남는다 */
    readonly finishEnding: (isRegistered: boolean) => void
    /** 명예의 전당 등록이 된 그 순간 — 모드 저장을 지운다(0x62dbe → 0x224ec). 엔딩을 떠날 때까지 다시 저장하지 않는다 */
    readonly eraseSaveForHallOfFame: () => void
    /** 111 장비 상점 · 121 장비착용을 연다 */
    readonly openShop: (tab: PitcherShopTab) => void
    /**
     * 상점·장비착용에서 한 칸을 고른다 (확인을 마친 뒤) — 0x13460 → 0x14a74 / 0x17ad0.
     * `globalOpenedHiddenIds` 는 기록연감의 전역 해금 id (원본 `app+0xc0` 표) — 커리어 것과 합쳐 본다.
     */
    readonly purchase: (itemId: string, globalOpenedHiddenIds?: readonly number[]) => void
    readonly closeShopGpDetail: () => void
    /** 105 커맨드 칸 3 [외출] → 상태 112 외출 지도 (0x126be — 모드 갈림 없음) */
    readonly openOuting: () => void
    /** 113 장소 기능 — 가드 0x16cf0 → 효과 0x15234 (→ 입원 회복 0x1575c). 모드 3·4 공용 (`outing.ts`) */
    readonly runOutingFunction: (functionId: string) => void
    /** 113 칸 0 [들어가기] — 배정된 장소 이벤트(0x8ce58), 없으면 빈 장소 440+장소를 114 로 튼다 */
    readonly enterOutingPlace: (place: OutingPlace) => void
    /** 126 효과 팝업 [확인] → (입원이면 회복 글) → 105 (틀 0x1575c) */
    readonly closeOutingResult: () => void
    /** 105 위 입원 회복 팝업 [확인] */
    readonly dismissOutingRecoveryNotice: () => void
    /**
     * 이벤트의 보상 명령 7 하나를 그 자리에서 준다 — 0x8d4c4 가 글 · 창을 세운 그 갱신의 0x8c460(모드 3 갈래). 저장은 안 한다
     * (원본도 0x7fe90 · 재생 끝 0x1c014 에서 저장한다). `StoryScreen.onReward` 로 잇는다.
     */
    readonly giveStoryReward: (items: readonly EventReward[], eventId: number, viewedEventIds?: readonly number[]) => void
    /**
     * 선택지 확인 — 0x8b804 의 8b8d8 `0x8b0e4(mgr)`: 떠나온 이벤트 줄 본 표시 · 112/113 에서 연 이벤트면 S+4 · 저장.
     * `StoryScreen.onChoiceConfirm` 으로 잇는다.
     */
    readonly confirmStoryChoice: (eventId: number, leftEventIds: readonly number[]) => void
    /** 이벤트 재생이 끝났다 — 지나온 보상과 본 이벤트 번호 (114 틀 0x1c014) */
    readonly completeStory: (rewards: readonly EventReward[], viewedEventIds: readonly number[], endingEventId?: number | null) => void
    /**
     * 이벤트의 system 창(알림 · 올해의 목표)을 답 0 으로 닫았다 — 0x8d928~0x8d942 의 0x7fe90: 나리라 S+0x1b7 = 1 · 저장(0x22755).
     * 하위와 상관없이 모든 system 창이다.
     */
    readonly confirmEventSystemWindow: () => void
    /** 이벤트가 경기 명령(마선수 대결)에 닿았다 — 대결 화면이 없을 때: 지나온 보상만 남기고 105 (근사) */
    readonly abortStoryAtMatch: (carry: StoryCarry) => void
    /** 경기 명령 → 투수 미션 레코드 team−1 로 마선수 대결 (장면 '마선수대결') */
    readonly beginAceMatch: (command: MatchCommand, carry: StoryCarry) => void
    /** 대결이 끝났다 — 105 진입이 +0x176 을 보고 140 → 결과 이벤트 resultEvents[이김 ? 0 : 1] */
    readonly finishAceMatch: (isWin: boolean) => void
    /**
     * 대결 경기 중 "나가기" 0x40140 — 플래그를 안 보고 메인 메뉴(0x103)로, 저장 없음. 부르는 쪽이 메인 메뉴로 간다.
     * 대기 칸(전역기록 — `aceMatchPending`)은 남아 다음 105 진입이 진 결과 이벤트를 띄운다.
     */
    readonly quitAceMatch: () => void
    readonly dismissStoryNotice: () => void
    /** 128 [다음] — 키 0x13da0 (끝났으면 우승 발표 · 내 차례면 경기 · 아니면 CPU 끼리) */
    readonly pressPostseason: () => void
    /** 128 팝업 닫힘 — 틀 0x15984 */
    readonly closePostseasonPopup: () => void
    /** 국가대항전 135 확인(0x10680) → 142 경기 준비 */
    readonly startCupGame: (matchup: NationalCupMatchup, cup: NationalCup) => void
    /** 국가대항전 끝 — 결과·보상 팝업을 닫았다 (0x1b92c → 새 시즌 0x1b768) */
    readonly finishCup: (finish: NationalCupFinish) => void
    readonly reset: () => void
  }
}

/**
 * 저장을 불러올 때 **빠진 칸을 기본값으로 메운다**.
 *
 * 커리어에 칸을 더할 때마다 옛 저장에는 그 칸이 없어 `undefined` 가 된다 — 그대로 캐스팅하면
 * 화면이 조용히 어긋난다(예: 마구 고른 번호가 없어 "사용 중" 표시가 안 된다).
 * 새 커리어 한 벌을 바탕에 깔고 저장을 덮어쓰는 것으로 한 번에 막는다.
 *
 * ⚠️ 겉만 덮어쓰면 **한 겹 안쪽 칸**은 못 메운다. 리그 선수 기록표에 투수 줄(`pitchers`)이
 * 새로 생겼는데 옛 저장에는 `{ batters }` 뿐이라, 그대로 두면 `pitchers` 가 `undefined` 인 채
 * 돌아다닌다. 저장 형식 번호는 올리지 않는다 — 올리면 옛 저장이 통째로 버려져 선수가 사라진다.
 */
function normalizePitcherCareer(raw: unknown): PitcherCareer | null {
  if (raw === null || typeof raw !== 'object') return null
  const saved = raw as Partial<PitcherCareer>
  if (typeof saved.name !== 'string') return null
  const base = createPitcherCareer(saved.name)
  return {
    ...base,
    ...saved,
    stats: { ...base.stats, ...saved.stats },
    careerStats: { ...base.careerStats, ...saved.careerStats },
    leaguePlayerStats: { ...base.leaguePlayerStats, ...saved.leaguePlayerStats },
    // 완투 계열 칸(+0x1f0[0..3])은 나중에 생긴 칸이다 — 옛 저장은 0 에서 시작한다
    completeGameCounts: { ...base.completeGameCounts, ...saved.completeGameCounts },
    /*
     * 장착 칸(선수기록 +0x14)은 나중에 생긴 칸이다 — 바탕의 신인 값([0, 8])을 그대로 두면 보유와 어긋난다.
     * 예전 웹엔 장착 창이 없어 장착은 모두 획득 때의 자동 장착(0xa4bd8 → 0xa4b04, 모드 3 도 같다)뿐이었으므로
     * 타자편 저장(`localStorageSaveGame`)과 같이 보유 목록(얻은 차례)을 단계 0 에서 다시 자동 장착해 세운다.
     * 슬롯 단계(+0x1c6)는 바탕의 0 이 그대로 들어간다.
     */
    equippedSkillIds: saved.equippedSkillIds ?? rebuildEquippedSkillIds(saved.skillIds ?? base.skillIds),
    // 나리 팀 레코드는 바탕(기본 팀·선발 보직의 등록 꼴)을 쓰면 안 된다 — 없던 옛 저장은 없는 채로(`nariTeamsOf` · 날짜 셈이 세운다)
    nariTeams: saved.nariTeams,
    /*
     * 컬렉터 해금(20·24·28·32)은 구매 확정 0x14a74 가 전역 표에 켜 둔 것이다 — 그보다 앞서 산 옛 저장은 칸이 비어 있을 수 있어
     * 보유에서 다시 센다(`pitcherCollectorHiddenIdsOf`). `isPitcherHiddenOpen` 은 이 표만 본다.
     */
    openedHiddenIds: withCollectorIds(saved.openedHiddenIds ?? base.openedHiddenIds, pitcherCollectorHiddenIdsOf({
      ...base,
      ...saved,
    } as PitcherCareer)),
  }
}

/** 해금 id 를 더한다 — 이미 있으면 그대로 */
function withCollectorIds(ids: readonly number[], collector: readonly number[]): readonly number[] {
  const missing = collector.filter((id) => !ids.includes(id))
  return missing.length === 0 ? ids : [...ids, ...missing]
}

const NO_STAT = () => {}

/**
 * 116 평가 징글 — 진입 끝 12c96~12cc6 `0x6e499(소리, …)`: S+0x4a < 0 → 38 · ≤ 1 → 37 · > 1 → 36 (모드 3·4 공용 — 타자편과 같다).
 */
/**
 * 이어하기 116 다시 돌기의 감독 글 — 0x1278c 는 저장의 S+0x4a(지난 평가 인기도 변화) · S+0x62(지금 평판) · 포지션 코드
 * (0xb6395, 내 투수 레코드)와 **전역 경기 상태**(위) · S+0x1d8[6] 으로 **다시 고른다**(12822~12afe). 저장해 둔 글 번호를 쓰지 않는다.
 */
function resumedPitcherLastGameOf(career: PitcherCareer): PitcherCareer {
  const { lastGame } = career
  if (lastGame === undefined) return career
  const neverEntered = career.role !== PITCHER_ROLE.starter
    // 전역 경기 상태 +0x6b 의 지금 값 — 앱을 새로 켰으면 0, 아니면 마지막으로 돈 경기(모드 불문)의 이닝 (`liveGameState`)
    && reliefNeverEnteredOf(liveGameInningIndex())
    && ((lastGame.pitches ?? 0) & 0xff) === 0
  const managerCommentIndex = managerCommentIndexOf(
    { role: career.role, neverEntered, reputation: career.reputation, positionCode: career.positionCode },
    (career.lastEvaluation ?? NO_LAST_EVALUATION).popularityChange,
  )
  return { ...career, lastGame: { ...lastGame, managerCommentIndex } }
}

function pitcherEvaluationJingleIdOf(popularityChange: number): number {
  if (popularityChange < 0) return 38
  return popularityChange > 1 ? 36 : 37
}

/**
 * 리그 경기 옵션 — 화면 쪽 옵션(`pitcherGameOptionsOf`)에 경기 준비 0x1c46c 가 세운 리그 투수를 얹는다:
 * 상대 팀 레코드 차례(g ≠ 0 이면 한 칸 돈 것 · 포스트시즌은 시리즈 이월)와 양 팀 칸별 +0x2c (`pitcherLeagueGameSetupOf`).
 */
function leagueGameOptionsOf(career: PitcherCareer, settings: Parameters<typeof pitcherGameOptionsOf>[1]): PitcherGameOptions {
  const options = pitcherGameOptionsOf(career, settings)
  return { ...options, ...pitcherLeagueGameSetupOf(career, options.opponentTeamId) }
}

/**
 * 463 출전 — 상태 133 이 `0xb7bf1(L)` 로 세운 대회와 대표팀 칸(모드 3 갈래 0xb521d 내 칸)을 들고 S+0x50 = 3(웹 null) ·
 * S+0x12c = 1. 보상 명령 뒤(0x8cca2)와 재생 끝(`continueYearEnd`) 둘 다 이 꼴이다 — 굴림 없이 서므로 두 번 세워도 같은 값이다.
 * 칭호 8 은 134 첫 틀(0x1b92c 머리) 몫이라 여기 없다.
 */
/** 134 첫 틀(0x1b92c 머리)의 칭호 8 — 비트 8 이 이미 섰으면 그대로 */
function withNationalCupTitle(career: PitcherCareer): PitcherCareer {
  const title = nationalCupStandingsTitleOf(career.titleIds)
  return title === null ? career : awardPitcherTitles(career, [title])
}

function withPitcherNationalCupEntered(career: PitcherCareer): PitcherCareer {
  const cup = createNationalCup()
  return {
    ...career,
    seasonEndState: null,
    nationalCup: cup,
    nariCupTeams: createPitcherCupTeams(career.positionCode, nationalCupMatchupOf(cup)?.opponent ?? KOREA_TEAM_ID),
  }
}

/**
 * 보상 명령 뒤 이어하기 자리 — 0x8c460 끝 8cc2e(나리 갈래, 모드 3 이라 393~396 은 0xd) → 8cd44 저장 (`rewardResumePatchOf`).
 * 464 의 S+0x12c = 0 은 웹이 464 앞에 대회를 세우지 않아 이미 그 값이다.
 * 그 앞, 줄을 도는 동안 보상 20(연봉)은 8cb90 에서 S+0x50 = 0xa 를 쓴다(`rewardItemsResumeCodeOf` — 웹 133).
 */
function withPitcherRewardResumePatch(career: PitcherCareer, eventId: number, items: readonly EventReward[]): PitcherCareer {
  const itemsCode = rewardItemsResumeCodeOf(items)
  const itemsState = itemsCode === null ? undefined : nariSeasonEndStateOfResumeCode(itemsCode)
  const salaried = itemsState === undefined || career.seasonEndState === itemsState ? career : { ...career, seasonEndState: itemsState }
  const patch = rewardResumePatchOf(eventId, '나리투수')
  if (patch === null) return salaried
  if (patch.nationalCup === true) return withPitcherNationalCupEntered(salaried)
  const state = nariSeasonEndStateOfResumeCode(patch.resumeCode)
  return salaried.seasonEndState === state ? salaried : { ...salaried, seasonEndState: state }
}

/** 저장의 국가대항전 대회 레코드 두 칸 — 없으면(대회 중 옛 저장) 대회 초기화 꼴로 세운다 */
function pitcherCupTeamsOf(career: PitcherCareer, opponentTeamId: number): NariCupTeams {
  return career.nariCupTeams ?? createPitcherCupTeams(career.positionCode, opponentTeamId)
}

/**
 * **국가대항전 경기 옵션** — 경기 장면 0xb891c 가 대회 레코드 두 칸(0x1f940: S+0x12c 면 팀 10 → +0xbc4, 그 밖 → +0xbe0)으로 선다.
 * 내 팀 = 대표팀(10) · 측 = 0xb7844 의 L+0xac 갈래(대진 칸 0 이 후공, `nationalCupSideOf`) · g = 대회 날짜 L+0x32 ·
 * 대표팀 투수 배열(내 투수 복사본 — 포지션 코드는 그 칸) · 스태미나는 날마다 10000(0xb6190, 복사본 포함) · 팀 사기 = 마스터 복사본 +2 ·
 * 마선수 없음(1c5fe) · 0xa56dc 는 S+0x12c 라 거짓(기록 안 셈).
 */
function cupGameOptionsOf(
  career: PitcherCareer,
  matchup: NationalCupMatchup,
  cup: NationalCup,
  settings: Parameters<typeof pitcherGameOptionsOf>[1],
): PitcherGameOptions {
  const teams = pitcherCupTeamsOf(career, matchup.opponent)
  const options = pitcherGameOptionsOf(career, {
    ...settings,
    opponentTeamId: matchup.opponent,
    playerSide: nationalCupSideOf(cup, matchup.myTeam) as PlayerSide,
    teamMorale: teamMoraleOf(matchup.myTeam),
  })
  return {
    ...options,
    ourTeamId: matchup.myTeam,
    dayCounter: cup.day,
    isPostseason: false,
    isNationalCup: true,
    positionCode: pitcherCupPositionCodeOf(teams),
    stamina: FULL_STAMINA,
    ourPitcherOrder: gameMyPitcherOrderOf(teams.korea.pitchers ?? []),
    opponentPitcherOrder: nariCupRecordOf(teams, matchup.opponent).pitchers,
    isRivalGame: false,
  }
}

/** 보상 종류 7 — 히든 오픈 |v| */
const HIDDEN_OPEN_REWARD_KIND = 7

/**
 * 보상 종류 7 의 알림 글 — 0x8c60e 가 `0x62368(…, |v|, 1)` 을 부른다. 셋째 인자 1 이면 이미 열렸는지(0x61f5c)를
 * 보지 않고 **늘** 팝업(0x74ef5)을 띄운다: StrCOMMON[139] "히든 아이템 오픈!! [%s]" + 쓰는 곳 줄
 * (id ≤ 18 [141] 시즌 · ≤ 34 [142] 투수편 · ≤ 50 [143] 타자편, 0x62420~0x62480). 글은 상점 알림과 같은 함수로 만든다.
 */
function hiddenOpenNoticeOf(rewards: readonly EventReward[]): string {
  return rewards
    .filter((reward) => reward.kind === HIDDEN_OPEN_REWARD_KIND)
    .map((reward) => {
      const id = Math.abs(reward.value)
      return pitcherHiddenOpenTextOf(id) ?? hiddenOpenTextOf(id)
    })
    .filter((text): text is string => text !== null)
    .join('!N')
}

/** 496 "정말로 은퇴하려는 거냐?" — 502 "은퇴한다" 의 gotoEvent (선택지 380 / 503) */
const RETIREMENT_CONFIRM_EVENT_ID = 496

/**
 * **match 로 나가는 장소 이벤트의 끝 처리** — 이벤트 관리자 0x8cf64 의 match(SYS 8, 0x8d734~0x8d904)는 미션 장면 전환
 * (0xbdae9)을 걸고 0x8a380 으로 관리자를 비운 뒤 **1(끝남)** 을 돌려준다(보통 이벤트 끝 0x8d506 → 0x8d8ee 와 같은 꼬리).
 * 그래서 같은 틀의 114 끝 처리 0x1c014 가 그 자리에서 돌아, 뒤 상태가 113 이고 +0x167 == 0 이면 S+4 = 1(행동함) ·
 * S+0x6a(외출 수)++ · 105 · 저장을 한다. match 는 빈 장소 이벤트(440~444)에 없다. 장소가 아니면 그대로.
 */
function settlePlaceForAceMatch(current: PitcherCareer, context: PitcherStoryContext): PitcherCareer {
  return context === '장소'
    ? spendPitcherCycleAction({ ...current, outingsThisSeason: current.outingsThisSeason + 1 })
    : current
}

/** 연봉 칸 한 단위(100만원)를 금액 서식(만원 단위)으로 — 0x8bc4c 의 ×100 */
const MONEY_TEXT_SCALE = 100

/** 이어하기 — 저장에서 고른 이어할 자리와 그 자리에 들어서며 고친 커리어 (상태 100 진입 0x1c154) */
interface PitcherResume {
  readonly career: PitcherCareer | null
  readonly point: PitcherResumePoint
}

function pitcherResumeOf(saved: PitcherCareer | null): PitcherResume {
  const point: PitcherResumePoint = saved === null ? { kind: '관리' } : pitcherResumePointOf(saved)
  return {
    career: saved !== null && point.kind === '이벤트'
      ? enterPitcherYearEndEvent(saved, point.eventId)
      // 1c25e — S+0x50 == 0x11(464 거절 보상 뒤 끊김) → 새 시즌 처리 0x1b768 → 137 → 105
      : saved !== null && point.kind === '새시즌' ? startNextPitcherSeason(saved)
      // 134 의 틀 0x1b92c 머리 — 들어온 첫 틀에 비트 8 이 없으면 칭호 8 "국가 대표" (463 보상 뒤 끊겼으면 아직 없다)
      : saved !== null && point.kind === '국가대항전' ? withNationalCupTitle(saved)
      // S+0x50 == 2 → 116 진입 0x1278c 다시 — 경기 뒤 카운터를 한 번 더 쓴다(겹쳐 쌓임). 정산(0x4ea0c)은 다시 안 돈다
      : saved !== null && point.kind === '경기결과' ? enterPitcherGameEvaluation(resumedPitcherLastGameOf(saved)) : saved,
    point,
  }
}

function pitcherSceneOfResume(career: PitcherCareer | null, resumePoint: PitcherResumePoint): PitcherScene {
  return career === null
    ? '등록'
    : resumePoint.kind === '이벤트'
      ? '이벤트'
      : resumePoint.kind === '포스트시즌'
        ? '포스트시즌'
        : resumePoint.kind === '시즌종료'
          ? '시즌종료'
          // 109 — 이전 상태가 1(자원 적재)이라 `nextGameFromManagement` 는 거짓 그대로다
          : resumePoint.kind === '다음경기순위'
            ? '다음경기순위'
            : resumePoint.kind === '경기결과'
              ? '경기결과'
              // 0x1c154 그 밖 갈래 S+0x12c → 134 — 저장의 대회로 대진판부터
              : resumePoint.kind === '국가대항전' ? '국가대항전'
                // 1c24e S+0x50 == 6 → 141 — 보너스를 받은 저장(S+0x7b)이라 키 0x1220c 가 등록 팝업 0x2d 로 간다
                : resumePoint.kind === '엔딩' ? '엔딩' : '관리'
}

function pitcherStoryOfResume(resumePoint: PitcherResumePoint): PitcherStory | null {
  return resumePoint.kind === '이벤트' ? { eventId: resumePoint.eventId, context: '연말', viewed: [] } : null
}

function postseasonPopupOfResume(career: PitcherCareer | null, resumePoint: PitcherResumePoint): PostseasonPopup | null {
  // 128 진입 0x120a4 를 다시 밟는다 — 정규시즌 우승 보상을 아직 안 받았고 1위면 팝업 0xb
  return career !== null && resumePoint.kind === '포스트시즌' ? regularSeasonPopupOnEnter(career) : null
}

function cupViewOfResume(resumePoint: PitcherResumePoint): { cup: NationalCup; atStandings: boolean } | null {
  return resumePoint.kind === '국가대항전' ? { cup: resumePoint.cup, atStandings: false } : null
}

export function usePitcherLeagueSession(
  store: JsonStorePort,
  random: RandomPort,
  gaugeSettingOn: boolean,
  /**
   * 전역 G 지갑 (원본 `mgr[+0x64]`). 넘기면 **G의 주인이 지갑**이 되고 커리어 칸은 따라간다.
   * 안 넘기면 예전처럼 커리어 칸 하나로만 돈다 — 테스트는 그대로 두면 된다.
   */
  wallet: GamePointWalletSession | null = null,
  /** 옛 투수 G를 지갑으로 옮겼는지 적어 두는 칸 — 아래 **투수 G 이사** 참고 */
  mergeStore: JsonStorePort | null = null,
  /**
   * 환경설정 "송구" 가 수동인가 (설정 +0xf4). 투수편은 사람이 언제나 수비라 이 값 하나가
   * `0xae6c8` 의 답이 된다. **원본 기본값은 수동** 이라 안 넘기면 수동이다.
   * (자리가 끝에 붙은 것은 앞의 인자 차례를 바꾸지 않으려는 것뿐이다.)
   */
  throwModeManual: boolean = true,
  /**
   * 기록연감 통계 `[mgr+0xc8]` 에 한 건 쌓는다 (GP 아이템 0x22e35 · G 사용처 0x22c29 · 획득 GP 0x22c7d · 켠 스킬 0xb663c, 모드 3).
   * 안 넘기면 아무것도 안 쌓는다.
   */
  recordStat: (event: AnnalsStatEvent) => void = NO_STAT,
  /**
   * 전역 마선수 레벨 열 칸 `mgr[0x13a..0x143]` (`useAceLevels().levels`). 같은 날 CPU 끼리 경기(0xc2a48)·포스트시즌
   * CPU 경기(0xc2760)의 마선수 능력치 배율(0xd88aa)이 이 칸을 본다. 안 넘기면 Lv1(60%).
   */
  aceLevels?: Readonly<Record<number, number>>,
  /**
   * 정규시즌 우승 팝업 0xb 닫힘(0x15b84~0x15c52)의 0x29 "오토봇 배트" 검사가 적재해 읽는 다른 두 저장 — 나리 타자편 저장
   * +0x7a · 시즌모드 시즌 기록 +0x7a · 전역 해금표 `app+0xc0`. 팝업을 닫을 때 읽는다. 안 넘기면 검사를 건너뛴다.
   */
  readRegularSeasonOtherModes?: () => RegularSeasonOtherModes | undefined,
  /**
   * 열린 마선수 로컬 번호 (전역 저장 +0x30.. · +0x35.., `useAceOpen`) — 142 진입 0x1c46c 의 내 팀 마선수 굴림(0x9f604 · 0x9f650)이
   * 본다. 안 넘기면 기본 개방 둘(마투수 0 · 마타자 0).
   */
  openedAces: NariOpenedAces = DEFAULT_NARI_OPENED_ACES,
  /**
   * 전역기록 +0x4f(모드 3 "투수편 경기 중간 저장됨") 칸 — 142 확인이 세우고 등록·정산·지우기가 내린다(`entities/mode-save`).
   * 안 넘기면 아무 데도 안 쓴다.
   */
  nariGameSave?: NariGameSavePort,
  /**
   * 나간 마선수 대결 대기 칸 — 원본 **전역기록** g[0x170] · g[0x172] · g[0x176] · g[0x177](투수편, `entities/mode-save`
   * `withAceMatchHeld`). 선수를 새로 만들어도 남는다. 안 넘기면 세션 메모리에만 든다.
   */
  aceMatchPending?: AceMatchPendingPort,
  /**
   * 지금 투수편 화면(장면 0x106)이 서 있나 — 원본은 장면을 떠나면 헐고 다시 들어올 때 100 → 105 진입을 다시 돈다. 메인 메뉴 등
   * 다른 화면에 있는 동안 105 도착 고리(부상 엔딩 · 나간 대결 · 115 · 훑기)가 돌지 않게 한다. 안 넘기면 늘 서 있다.
   */
  isOnScreen = true,
): PitcherLeagueSession {
  /** 전역기록 +0x4f 손잡이 — 콜백 신원이 흔들리지 않게 ref 로 읽는다 */
  const nariGameSaveRef = useRef(nariGameSave)
  nariGameSaveRef.current = nariGameSave
  /** 나간 마선수 대결 대기(전역기록) 손잡이 — 안 넘기면 세션 메모리 */
  const memoryAceMatchPending = useMemo(() => createMemoryAceMatchPendingPort(), [])
  const aceMatchPendingRef = useRef(aceMatchPending ?? memoryAceMatchPending)
  aceMatchPendingRef.current = aceMatchPending ?? memoryAceMatchPending
  const loaded = useRef<PitcherCareer | null>(null)
  if (loaded.current === null) loaded.current = normalizePitcherCareer(store.load())
  /** 띄울 때 저장에 들어 있던 G — 다리가 갈아 끼우기 전의 값이라 첫 렌더에서 떠 둔다 */
  const legacyGamePoint = useRef<number | null>(null)
  if (legacyGamePoint.current === null) legacyGamePoint.current = loaded.current?.gamePoint ?? 0

  /**
   * **이어하기** — 장면 0x106 에 들어오면 상태 100 진입 0x1c154 가 S+0x50 으로 돌아갈 상태를 고른다 (`pitcherResumePointOf`).
   * 시즌 끝 사슬 안이면 그 상태로 돌아가 진입에서 하는 일을 다시 한다 — 136·130·131·132 는 이벤트를 다시 틀고
   * (375 는 MVP 비트를 다시 — 같은 값), 128 은 진입 0x120a4 를 다시 밟는다(S+0x77 이 서 있으면 팝업 0xb 를 다시 안 띄운다).
   * 경기 뒤(116, S+0x50 = 2)에 끊겼으면 116 의 끝처럼 대진이 있을 때 g == 0 → 시즌 끝(136 자리) · 아니면 128.
   * 타자편 794c8d9 `continueSaved` 와 같은 꼴이다.
   */
  const resumed = useRef<PitcherResume | null>(null)
  if (resumed.current === null) resumed.current = pitcherResumeOf(loaded.current)
  /** 이어할 자리 — 엔딩을 등록 없이 떠나면(`finishEnding(false)`) 남은 저장으로 다시 고른다 */
  const [resumePoint, setResumePoint] = useState<PitcherResumePoint>(resumed.current.point)
  const [career, setCareer] = useState<PitcherCareer | null>(resumed.current.career)

  /**
   * **켠 스킬 통계** (`0xb663c` → `[mgr+0xc8]+0xf8`, 모드 3) — 장착 0xa4b04 가 새로 켤 때마다 비트를 OR 한다.
   * 켜는 길(스킬 창 0x147b0 · 획득 자동 장착 0xa4bd8)이 어디든 앞뒤 장착 목록을 견줘 새로 켜진 것만 적는다.
   * 불러오기·새 선수(앞이 없거나 다른 선수)는 견주지 않는다.
   */
  const equippedBeforeRef = useRef<{ name: string; ids: readonly number[] } | null>(null)
  useEffect(() => {
    const before = equippedBeforeRef.current
    if (career === null) {
      equippedBeforeRef.current = null
      return
    }
    equippedBeforeRef.current = { name: career.name, ids: career.equippedSkillIds }
    if (before === null || before.name !== career.name || before.ids === career.equippedSkillIds) return
    skillEquipStatEventsOf(PITCHER_LEAGUE_MODE, before.ids, career.equippedSkillIds).forEach(recordStat)
  }, [career, recordStat])
  const [scene, setScene] = useState<PitcherScene>(() => pitcherSceneOfResume(career, resumePoint))
  const [gameOptions, setGameOptions] = useState<PitcherGameOptions | null>(null)
  const [story, setStory] = useState<PitcherStory | null>(() => pitcherStoryOfResume(resumePoint))
  const [storyNotice, setStoryNotice] = useState('')
  /** 128 로 넘어가며 접어 둔 연말 사슬의 본 번호 — 128 이 끝나면 여기서 132 로 잇는다 */
  const yearEndViewedRef = useRef<readonly number[]>([])
  const [postseasonPopup, setPostseasonPopup] = useState<PostseasonPopup | null>(() => postseasonPopupOfResume(career, resumePoint))


  /** 이벤트 재생(114)으로 — 뒤 상태는 `story.context` 가 정한다 */
  const openStory = useCallback((next: PitcherStory) => {
    setStory(next)
    setScene('이벤트')
  }, [])

  /**
   * r_event 본문(events.ts, 535KB)은 첫 화면에 필요 없어 커리어가 생긴 뒤 따로 불러온다 — 타자편
   * `useStorySchedule` 과 같은 방식(번들러가 별도 청크로 자른다). 오기 전에는 장소 이벤트가 없는 것으로 본다.
   */
  const [fileEvents, setFileEvents] = useState<readonly OriginalEvent[] | null>(null)
  useEffect(() => {
    if (career === null || fileEvents !== null) return
    let isActive = true
    void import('@/shared/config/original/events').then((module) => {
      if (isActive) setFileEvents(module.ORIGINAL_EVENTS)
    })
    return () => {
      isActive = false
    }
  }, [career, fileEvents])
  /** 재생기에 넘기는 목록 — 파일 이벤트 뒤에 연초 115 내장 이벤트를 붙인다 (훑기·배정은 파일 것만 본다) */
  const storyEvents = useMemo(
    () => (fileEvents === null ? null : [...fileEvents, PITCHER_YEAR_START_EVENT]),
    [fileEvents],
  )

  /**
   * 이벤트 레코드 커서 (0xadc70 의 reader+0x28) — 105·112 자동 발동이 함께 쓴다.
   * ⚠️ 근사: 원본 reader 는 장면이 들고 저장에 없다 — 웹은 세션 동안만 든다 (타자편 `useStorySchedule` 과 같다).
   */
  const cursorRef = useRef(0)
  /** 새 선수 플래그 (장면+0x165) — 등록(104)에서 100 으로 왔을 때 켜진다 (0x1c3be). 오프닝 451 을 부른다 */
  const newPlayerRef = useRef(false)

  /** 판정 없음(e = −1) 엔딩은 141 이 저장하지 않는다 — 엔딩 칸을 비운 114 끝의 커리어가 남는다 (`savedCareerOf`) */
  /**
   * 명예의 전당 등록(0x62dbe → 0x224ec(저장, 3))으로 모드 저장을 지운 뒤 — 등록 꼬리(0x62dc4~)는 G − 20000 · 전역 저장 0x1f1b9 ·
   * 0x1f1e1 뿐이고 모드 저장 0x22755 를 다시 부르지 않는다. 엔딩을 떠날 때까지 커리어가 바뀌어도(지갑 다리의 G) 저장하지 않는다.
   */
  const isSaveErasedRef = useRef(false)
  const commit = useCallback(
    (next: PitcherCareer) => {
      setCareer(next)
      if (!isSaveErasedRef.current) store.save(savedCareerOf(next))
    },
    [store],
  )

  /**
   * **직전 값을 받아** 고쳐 넣는 저장 (`commit` 의 함수 꼴).
   *
   * 같은 프레임에 커리어를 고치는 자리가 둘(칭호 부여·지갑 다리)이라, 둘 다 자기가 본 옛 커리어를
   * 통째로 덮어쓰면 **나중에 붙은 쪽이 앞의 결과를 지운다.** 실제로 `StrictMode`(main.tsx)가
   * 고리를 다시 붙일 때 칭호 쪽이 옛 G를 되살려, 지갑 1000 + 투수 1500 이 2500 이 아니라 1500 이 됐다.
   *
   * ⚠️ 저장을 고치는 함수 안에서 하므로 `StrictMode` 에서는 **같은 값을 두 번 쓴다** — 값이 같아
   *    문제는 없다.
   */
  /**
   * 이어하기로 116 을 다시 띄웠으면(`resumePoint` '경기결과') 진입 끝처럼 저장(12c84)하고 평가 징글을 다시 낸다 — 한 번만.
   */
  const replayedEvaluationRef = useRef(false)
  useEffect(() => {
    if (replayedEvaluationRef.current || resumePoint.kind !== '경기결과') return
    replayedEvaluationRef.current = true
    const replayed = resumed.current?.career
    if (replayed === null || replayed === undefined) return
    store.save(replayed)
    playSoundIds(activeSound(), [
      pitcherEvaluationJingleIdOf((replayed.lastEvaluation ?? NO_LAST_EVALUATION).popularityChange),
    ])
  }, [resumePoint, store])

  /**
   * 이어하기로 새 시즌 처리를 했으면(`resumePoint` '새시즌' — 1c25e S+0x50 == 0x11 → 0x1b768) 그 자리에서 저장한다 — 한 번만.
   * 0x1b768 은 연차 + 1 · 소지금 · S+0x50 = 1 · 기록 칸 정리 뒤 1b894~1b8a4 에서 `0x1fded · 0x22755([0x1400054], 1)` 로
   * **곧바로 저장하고** 화면 전환(0xbdae9) · +0x289 = 1(→ 137) 을 건다(직접 떴다). 예전 웹은 띄울 때 메모리에만 두어, 다른 저장
   * 없이 끄면 저장이 앞 해(S+0x50 = 0x11) 그대로 남았다.
   */
  const resumedNewSeasonRef = useRef(false)
  useEffect(() => {
    if (resumedNewSeasonRef.current || resumePoint.kind !== '새시즌') return
    resumedNewSeasonRef.current = true
    const started = resumed.current?.career
    if (started === null || started === undefined) return
    store.save(started)
  }, [resumePoint, store])

  const commitWith = useCallback(
    (update: (current: PitcherCareer) => PitcherCareer) => {
      setCareer((current) => {
        if (current === null) return current
        const next = update(current)
        if (next === current) return current
        if (!isSaveErasedRef.current) store.save(savedCareerOf(next))
        return next
      })
    },
    [store],
  )

  /**
   * **투수 G 이사** — 옛 투수 저장은 G를 `career.gamePoint` 안에 들고 있었다(시즌모드와 달리
   * 저장에 실제로 들어 있다). 원본은 G가 전역 한 칸(`mgr[+0x64]`)이라 투수편만의 G가 애초에
   * 있을 수 없다 — 웹이 나눠 둔 탓에 생긴 주머니라, 지갑으로 합칠 때 **타자편 몫에 더한다.**
   *
   * ⚠️ **왜 더하나** (타자편 이사와 겹치는 자리):
   *   두 주머니 다 신인 지급분이 0 에서 시작한다 (`BALANCE.rookie.gamePoint === 0`). 그러니
   *   타자편 B = (번 것 − 쓴 것), 투수편 P = (번 것 − 쓴 것) 이고, 원본처럼 한 칸이었다면
   *   그 칸 값은 정확히 **B + P** 다. 어느 한쪽을 이기게 하면 다른 쪽에서 번 G가 통째로 사라진다.
   *   (원본에 두 값이 따로 있던 적이 없으므로 "어느 쪽이 진짜냐"는 물음 자체가 웹의 사정이다.)
   *
   * 표식 칸(`mergeStore`)을 따로 두는 까닭: 이사를 마치면 커리어 칸은 지갑의 그림자라
   * 저장만 봐서는 이미 옮겼는지 알 수 없다. 저장 형식 번호는 **올리지 않는다.**
   *
   * ⚠️ `?무한G` 면 지갑이 쓰기를 안 받는다 — 그대로 진행하면 표식만 서고 G가 사라지므로 **미룬다.**
   */
  const merged = useRef(false)
  useEffect(() => {
    if (wallet === null || mergeStore === null || merged.current) return
    if (isInfiniteGamePointOn()) return
    const done = (mergeStore.load() as { merged?: boolean } | null)?.merged === true
    merged.current = true
    if (done) return
    // 표식을 먼저 적는다 — 중간에 다시 띄워도 두 번 더해지지 않는다
    mergeStore.save({ merged: true })
    const carried = legacyGamePoint.current ?? 0
    if (carried !== 0) wallet.gain(carried)
  }, [mergeStore, wallet])


  /** 칭호 팝업 확인 0x1b1e4 */
  const confirmTitle = useCallback(() => {
    // 직전 값을 받아 붙인다 — 지갑 다리가 맞춰 둔 G를 옛 값으로 되돌리지 않는다 (`commitWith` 머리글)
    commitWith((current) => {
      const title = nextPitcherTitleOf(current)
      return title === null ? current : awardPitcherTitles(current, [title])
    })
  }, [commitWith])

  /**
   * 자동 발동 한 번 — 0x8be80 → 0xadc70 (커서에서 이어 훑기). 끝까지 없으면 커서가 0 으로 되감기고 그 호출은 "없음" 이라
   * 원본은 **다음 틀**에 처음부터 다시 훑는다 — 웹은 그 두 번째 틀까지 한 번에 본다(커서가 0 이 아니었을 때만).
   */
  const scanAuto = useCallback(
    (current: PitcherCareer, events: readonly OriginalEvent[], trigger: number, rolling: RandomPort | undefined) => {
      const from = cursorRef.current
      let scan = scanPitcherEventFrom(current, events, trigger, from, rolling)
      if (scan.event === null && from > 0) scan = scanPitcherEventFrom(current, events, trigger, 0, rolling)
      cursorRef.current = scan.cursor
      return scan.event
    },
    [],
  )

  /**
   * **관리 화면(105)의 이벤트** — 원본은 한 틀 안에서 두 자리가 차례로 돈다 (R9 2절 · A 3절):
   *
   * 1. **진입 0x11910 의 곁가지**(0x11b24~0x11c1c) — 부상 엔딩 → 미션 복귀 140 → **연초 115**(S+0x1b7 == 0) →
   *    **중간평가 117**(경기 수 22 · 그 해 비트 꺼짐) 중 하나를 다음 상태로 예약한다 (투수편엔 138 타순이 없다).
   * 2. **자동 발동 0x1cf9c** — 현재 상태가 105 면 **매 틀**:
   *    ```
   *      1cfa6: 장면+0x165(새 선수) ≠ 0 → 0x8bde0(모드 3 → 451) · [다음 114, 뒤 105] · 플래그 지움   ; 예약을 덮는다
   *      1cfdc: 다음 상태 ∈ {114, 115} 면 건너뜀                                                  ; 115 는 막고 117 은 안 막는다
   *      1cfe4: 전역 +0x11f · +0x176 이 서 있으면 건너뜀
   *      1d02c: 0x8be80(…, 화면코드 105) 찾으면 [다음 114, 뒤 105]                                ; 117 예약을 덮는다
   *    ```
   *    그래서 한 번 들어올 때의 차례는 **451 → 115 → (trigger 0 이벤트들) → 117** 이다(확정 — 상태 틀 0x1cdec 는 진입 점프표
   *    0xcc728 를 부른 뒤 **같은 틀에** 0x1cf9c 로 떨어지고, 0xbcb48 은 `+0xc = +8 ; +8 = s` 라 진입 0x11bd6 의 115 예약이 밀려
   *    사라진다. 타자편도 같다 — `useCareerSession`) — 덮인 예약은 이벤트에서
   *    105 로 돌아와 진입이 다시 돌 때 또 선다. 판정은 모드 3(대상 1·3, `isPitcherEventEligible`)이고, 히든 변화구 30~33
   *    (대상 3 · 능력치 조건)도 이 훑기 안에서 나온다.
   *
   * 부상 엔딩(500)은 도착 첫 줄이다(아래). 117 은 S+0xb2 == 22 && 0xa4280 == 0 (아래), 그 비트는 보상 실행기 끝(0x8cbaa)이 켠다.
   *
   * ⚠️ 근사 — 원본은 105 에 머무는 **매 틀** 훑고, 조건 22(질병 490)는 틀마다 rand 를 굴린다. 웹은 105 에 **들어올 때**
   *    (경기·이벤트·다른 화면에서 돌아올 때) 한 번 굴려 훑고, 105 에 머문 채 커리어가 바뀌면(훈련·아이템) 굴림 없이 다시
   *    훑는다 — 타자편(`useCareerSession` 의 '무작위포함'/'고정')과 같은 꼴이다. 틀 수를 따라 굴리지 않으므로 질병이 원본보다 드물다.
   */
  const wasIdleAtManagementRef = useRef(false)
  /** 112 다시 찍기(0x118e4) — 아래에서 정의되는 `enterOutingMap` 을 이 고리가 부른다 */
  const enterOutingMapRef = useRef<() => void>(() => {})
  useEffect(() => {
    const isIdle = isOnScreen && career !== null && scene === '관리' && story === null && fileEvents !== null
    if (!isIdle) {
      wasIdleAtManagementRef.current = false
      return
    }
    const isArrival = !wasIdleAtManagementRef.current
    wasIdleAtManagementRef.current = true
    if (!isArrival) {
      const event = scanAuto(career, fileEvents, EVENT_TRIGGER.관리, undefined)
      if (event !== null) openStory({ eventId: event.id, context: '관리', viewed: [] })
      return
    }
    if (newPlayerRef.current) {
      newPlayerRef.current = false
      const opening = pitcherOpeningScanOf(fileEvents, cursorRef.current)
      cursorRef.current = opening.cursor
      if (opening.event !== null) return openStory({ eventId: opening.event.id, context: '관리', viewed: [] })
    }
    if (pitcherInjuryEndingOf(career) !== null) {
      /*
       * **부상 엔딩** — 105 진입 곁가지 첫 줄 0x11b32~0x11b44: `0xa3a85(S) == 0` → 0x113e8 이 이벤트 500 을 번호로 틀고
       * (대상 0 — 훑기로는 안 나온다) `[다음 114, 뒤 141]`(0x11442~0x11454). 500 의 끝 명령(첫 종류 21)이 [0x1552adc] 를 켜
       * 114 끝 1c088 이 141 로 간다(`completeStory`). 예전 웹은 500 을 건너뛰고 곧장 엔딩 화면을 띄웠다.
       * 새 선수 오프닝(1cfa6)이 같은 틀에 예약을 덮으므로 그 뒤 — 451 이 끝나 105 로 다시 들어오면 진입이 500 을 다시 세운다.
       */
      return openStory({ eventId: INJURY_ENDING_EVENT_ID, context: '관리', viewed: [] })
    }
    const pendingResultEvents = aceMatchPendingRef.current.read()
    if (pendingResultEvents !== null) {
      /*
       * **나간 마선수 대결** — 진입 곁가지 0x11b6c~0x11bbe: 전역 g[0x176] 이 서 있고 모드가 4 가 아니면 현재를 112(0x70)로 ·
       * 0x7e84d(그림, 0x70) · 0x118e4([!] 칸 다시 찍기) · 다음 140. 140 진입 0x10df8 이 결과 바이트 g[0x177](SYS 8 이 적은 0 —
       * 짐, 대기 중 미션을 치렀으면 그 판 결과)로 resultEvents[이김 ? 0 : 1] 을 0x8bdc9 로 틀고 칸들을 지운 뒤 전역기록을 저장한다(10f72) · [다음 114, 뒤 105].
       */
      // 결과 바이트 g[0x177] — SYS 8 이 0, 대기 중 미션 정산 0x4ea0c 가 그 판 성공 여부로 덮어쓴다 (`withAceMatchResultWritten`)
      const isWon = aceMatchPendingRef.current.isWon()
      enterOutingMapRef.current()
      aceMatchPendingRef.current.clear()
      return openStory({ eventId: matchResultEventOf(pendingResultEvents, isWon), context: '대결결과', viewed: [] })
    }
    if (!career.hasSeenYearGoalWindow) {
      // 115 진입 0x16aac: 0x8a681 로 내장 이벤트를 세우고 `0xa4ee9(S)` — 마이너스 스킬 해제 기록 +0x1d0~+0x1d7 을 지운다
      commitWith((current) => (current.removedMinusSkillIds.length === 0 ? current : { ...current, removedMinusSkillIds: [] }))
      return openStory({ eventId: PITCHER_YEAR_START_EVENT_ID, context: '연초', viewed: [] })
    }
    const event = scanAuto(career, fileEvents, EVENT_TRIGGER.관리, random)
    if (event !== null) return openStory({ eventId: event.id, context: '관리', viewed: [] })
    if (career.gamesPlayed === MID_SEASON_GAME && !career.midSeasonEvaluatedYears.includes(career.season - 1)) {
      /*
       * 117 진입 0x11e84: k = 0xa3de9(S, 1) (투수 갈래 — 방어율 칸 그대로, 나머지 넷 >>1) →
       * k ∈ {4,5} 452 · k ≤ 1 454 · 그 밖 453. 칭호 1(1년차·k > 4) · 9(2년차~·지난 k ≤ 1·k > 4) 를
       * +0x270 에 넣고(0x11ee6~0x11f4a, 공통 칭호라 두 편 같다) 끝에 +0x1cc = k (0x11f5a).
       */
      const achieved = achievedPitcherGoalCount(career, '중간')
      // 직전 값을 받아 고친다 — 같은 프레임의 칭호·지갑 고리가 고친 것을 덮지 않게 (`commitWith` 머리글)
      commitWith((current) => {
        const titles = midSeasonTitlesOf(current, achieved).filter((title) => !current.titleIds.includes(title))
        return { ...awardPitcherTitles(current, titles), lastMidSeasonGoalCount: achieved }
      })
      openStory({ eventId: midSeasonEventId(achieved), context: '중간평가', viewed: [] })
    }
  }, [career, commitWith, fileEvents, isOnScreen, openStory, random, scanAuto, scene, story])

  /**
   * **커리어 칸 ↔ 지갑 다리** — 타자편(`useCareerSession`)과 같은 모양이다.
   *
   * 원본은 G가 전역 한 칸이라 다리가 필요 없지만, 웹은 구질 훈련·지옥훈련·엔딩 보너스가 전부
   * `PitcherCareer` 를 통째로 갈아 끼우는 식이라 커리어 칸을 아직 못 없앴다. 그래서 **나중에
   * 바뀐 쪽이 이기게** 이어 둔다 — 지갑이 주인이고, 커리어 칸은 저장 호환용 그림자다.
   *
   * - 커리어 쪽 G가 움직였으면(훈련 비용·기록 달성 보상·엔딩 보너스) 그 값을 지갑으로 옮긴다.
   * - 그 밖에 둘이 어긋나면 **지갑이 이긴다.** 선수를 불러온 참에 저장에 남은 옛 값이 지갑을
   *   되돌리는 것을 막는다 (이사는 위 고리가 딱 한 번만 한다).
   *
   * ⚠️ **칭호 부여 고리 뒤에 둔다.** 둘이 같은 프레임에 커리어를 갈아 끼우는데, 칭호 쪽은 통째로
   *    덮어쓰는 꼴이라 앞에 두면 다리가 맞춰 둔 G가 옛 값으로 되돌아간다. 뒤에 두고 **직전 값을
   *    받아** 고치면(`setCareer(current => …)`) 칭호도 G도 둘 다 남는다.
   *
   * ⚠️ **같은 짝을 두 번 보면 아무것도 안 한다** (`lastSeen`). `StrictMode` 는 고리를 붙였다 떼고
   *    다시 붙이는데(개발 빌드), 그때 두 번째 바퀴가 **옛 커리어 값**을 들고 돌아 "선수 쪽이
   *    움직였다" 로 잘못 읽는다 — 실제로 지갑 1000 + 투수 1500 이 2500 이 아니라 1500 이 됐다.
   */
  const walletBalance = wallet?.balance ?? 0
  const setWalletBalance = wallet?.setBalance
  const bridge = useRef<{ career: number | null; wallet: number }>({
    career: career?.gamePoint ?? null,
    wallet: walletBalance,
  })
  /** 고리가 마지막으로 **본** 짝 (커리어 G, 지갑 G) — 같은 짝이면 한 번 더 돌지 않는다 */
  const lastSeen = useRef<{ career: number | null; wallet: number } | null>(null)
  useEffect(() => {
    if (setWalletBalance === undefined) return
    // ⚠️ `?무한G` 면 다리를 놓지 않는다 — 지갑이 늘 99999 라 그대로 두면 저장에 99999 가 적혀
    //    스위치를 끈 뒤에도 값이 안 돌아온다 (devOptions: "저장에는 손대지 않는다").
    //    보여 주는 값은 아래 `overriddenGamePoint` 가 이미 지갑 값으로 맞춘다.
    if (isInfiniteGamePointOn()) return
    const careerPoint = career === null ? null : career.gamePoint
    const seen = lastSeen.current
    if (seen !== null && seen.career === careerPoint && seen.wallet === walletBalance) return
    lastSeen.current = { career: careerPoint, wallet: walletBalance }
    const previous = bridge.current
    if (career !== null && previous.career !== null && careerPoint !== previous.career) {
      bridge.current = { career: career.gamePoint, wallet: career.gamePoint }
      setWalletBalance(career.gamePoint)
      return
    }
    if (career !== null && career.gamePoint !== walletBalance) {
      bridge.current = { career: walletBalance, wallet: walletBalance }
      commitWith((current) => ({ ...current, gamePoint: walletBalance }))
      return
    }
    bridge.current = { career: careerPoint, wallet: walletBalance }
  }, [career, commitWith, setWalletBalance, walletBalance])

  const create = useCallback(
    (name: string, profile: PitcherRookieProfile) => {
      // 104 등록 확정 0x10fb4 — 전역기록 +0x40 + 모드 = 1 · +0x4c + 모드(+0x4f) = 0 (0x112b2 · 0x112c0)
      nariGameSaveRef.current?.clear()
      commit(createPitcherCareer(name, profile))
      // 등록 104 → 100 진입 끝(0x1c3be)이 이전 상태 104 를 보고 새 선수 플래그를 켠다 → 105 첫 틀에 오프닝 451
      newPlayerRef.current = true
      setScene('관리')
    },
    [commit],
  )

  /**
   * 경기 장면 0x39fdc 모드 3 갈래가 세울 경기 — 두 팀은 저장의 나리 팀 레코드로 선다: 142 진입 0x1c46c 가 넣은 마선수는 두 팀
   * 레코드의 9번(마타자)·8번(마투수) 칸이다. 타자 배열은 붙박이 + 마타자라 진행기가 세우는 명단(`withAceBatterLineup`)과 같다
   */
  const recordGameOptionsOf = useCallback(
    (current: PitcherCareer): PitcherGameOptions => {
      const options = leagueGameOptionsOf(current, { gaugeSettingOn, throwModeManual })
      const records = nariTeamsOf(current)
      const recordAces = recordMatchAcesOf(records, current.teamId, options.opponentTeamId)
      return recordAces === null ? options : {
        ...options,
        aces: {
          ours: recordTeamAcesOf(nariTeamRecordOf(records, current.teamId)),
          opponent: recordTeamAcesOf(nariTeamRecordOf(records, options.opponentTeamId)),
          ...(aceLevels === undefined ? {} : { levels: aceLevels }),
        },
      }
    },
    [aceLevels, gaugeSettingOn, throwModeManual],
  )

  const beginGame = useCallback(
    (from?: PitcherCareer) => {
      const current = from ?? career
      if (current === null) return
      // 경기 장면 셋업 0x39fdc 모드 3·4 갈래(0x3a200) — 0xb6814(전역 상태): +0x6b = 0
      resetLiveGameState()
      setGameOptions(recordGameOptionsOf(current))
      setScene('경기')
    },
    [career, recordGameOptionsOf],
  )

  /** 143 경기 전 엔트리 보기 (진입 0x16af8 · 키 0x1457c) — 142 위에 선다. 없으면 null */
  const [entryView, setEntryView] = useState<NariEntryView | null>(null)

  /** 109 순위표의 이전 상태가 105(관리)인가 — 취소·바닥 5 가 이것으로 갈린다 (0x105f0 · 0x16928) */
  const [nextGameFromManagement, setNextGameFromManagement] = useState(false)

  /** 142 진입 0x1c46c 가 이 장면에서 굴린 마선수 */
  const [matchAces, setMatchAces] = useState<NariMatchAces | null>(null)
  /**
   * 장면+0x288 — 142 의 마선수 넣기를 장면마다 한 번만 (1c566~1c572 · 1c668). 장면 셋업 0xfb7c 가 0 으로 둔다 →
   * 이 세션이 서는 때(이어하기)와 경기 뒤(`finishGame`)에 내린다.
   */
  const matchPreparedRef = useRef(false)

  /**
   * 국가대항전 대회 · 142 대진 · 치르는 대회 경기. 대회 칸은 커리어 저장(`nationalCup` — S+0x12c · L+0xa8~)에도 들어 이어하기가
   * 134 로 돌아온다(0x1c154 1c348~1c358).
   */
  const [cupView, setCupView] = useState<{ cup: NationalCup; atStandings: boolean } | null>(() => cupViewOfResume(resumePoint))
  const [cupMatch, setCupMatch] = useState<{ matchup: NationalCupMatchup; cup: NationalCup } | null>(null)
  const cupGameRef = useRef<NationalCup | null>(null)

  /** 142 경기 준비에 들어선다 — 이 장면에서 처음이면 마선수 넷을 굴린다(난수 4). 웹 투수편엔 국가대항전이 없다 */
  const openMatchPrepare = useCallback(() => {
    // 142 진입 0x1c46c 의 첫 줄(0x1c47a) — 0xb6814(전역 상태): +0x6b = 0
    resetLiveGameState()
    if (!matchPreparedRef.current) {
      matchPreparedRef.current = true
      const aces = rollNariMatchAces(random, openedAces)
      setMatchAces(aces)
      // 1c574~1c5ea — 내 팀 투수 배열을 오늘 준비대로(g == 0 0x1b684 · 0xa4f60 돌리기/맞바꿈), 포지션 코드 · g == 0 스태미나
      // (0x1c8a8) 도 같은 문 안이다. 1c62e~1c660 — 굴린 넷을 두 팀 레코드에 넣는다(저장에 남는다 — 빼는 코드가 없다)
      commitWith((current) => {
        const prepared = prepareMyPitcherMatch(current)
        return {
          ...prepared,
          nariTeams: seatNariMatchAces(nariTeamsOf(prepared), prepared.teamId, nextPitcherOpponentOf(prepared), aces),
        }
      })
    }
    setEntryView(null)
    setScene('경기준비')
  }, [commitWith, openedAces, random])

  /**
   * 경기 뒤 정산 — 성적·스태미나·전적을 넣고, 같은 날 나머지 네 경기를 돌린 뒤
   * 정규시즌·포스트시즌을 넘긴다 (타자편 `finishGame` 과 같은 차례다).
   */
  /**
   * 국가대항전 사람 경기가 끝났다 — 경기 끝 판(상태 0x18, 웹은 경기 화면의 `GameEndBoard`) [OK] 뒤 정산 0x4ea0c 차례(기록 달성 G →
   * 내 경기 승패 0xb76dc/0xb77e0 → S+4 = 0 → 같은 라운드 CPU 경기 0xc2dac → 하루 끝 0xb818c → 부상 경기 수 · S+0x7c)를 하고, 재진입
   * 0x1c154 가 S+0x12c 를 보고 134 로 돌려보낸다(116 을 안 지난다 — 4f03a 의 S+0x50 = 2 는 대회가 아닐 때만). 기록 G · 행동 · 부상 · 질병
   * 칸은 `settleNariCupGame`(타자편과 같다). 리그 승패 · 평가 · 스태미나 · 시즌 기록은 안 건드린다 — 내 기록은 대표팀 칸 복사본에
   * 쌓이고(0xa56dc 거짓) 대회 끝 0x1faa1 이 포인터를 원래 레코드로 돌린다.
   * ⚠️ 정산 그림 0x4a384(YOU WIN/LOSE · 보상 글)는 웹 투수편이 정규 경기에서도 안 그린다 — 대회도 같다.
   */
  const finishCupGame = useCallback(
    (summary: PitcherGameSummary, cup: NationalCup, options: PitcherGameOptions) => {
      cupGameRef.current = null
      // 경기 장면 0x104 를 지나 나리 장면이 새로 선다 — 장면+0x288 = 0
      matchPreparedRef.current = false
      // 정산 진입 0x4ea0c 의 0x4f3d6 — 모드를 가리지 않고 +0x4c + 모드 = 0
      nariGameSaveRef.current?.clear()
      // 전역 경기 상태 +0x6b 는 대회 경기도 남긴다
      setLiveGameInningIndex(summary.endedInningIndex ?? 0)
      // 0x4ea0c 4f072~4f136 — 후공(측 1) 점수가 더 많을 때만 후공 승, 동점이면 선공(측 0) 승 (`nariCupGameResultOf`, 타자편과 같다)
      const { winner, loser } = nariCupGameResultOf({
        mySide: options.playerSide,
        myTeam: options.ourTeamId,
        opponentTeam: options.opponentTeamId,
        myScore: summary.ourScore,
        opponentScore: summary.opponentScore,
      })
      // 같은 날 CPU 경기 두 나라는 상대국 칸 레코드를 쓴다 — 사람 경기 끝 상대 투수 칸별 +0x2c 에서 선다(701a7a9)
      const next = advanceNationalCupDay(cup, winner, loser, random, summary.pitcherStaminas?.opponent)
      // 기록 달성 G (4ebaa~4ec7c — 사람 팀 공·수로 거른 기록이라 대회 경기도 쌓인다. 강판 뒤는 0xa77f0 이 막아 요약에 없다)
      const gamePointReward = recordGamePointsOf(summary.recordIds)
      // 0x4ec82 `0x22c7d(G, 모드 3)` 획득 GP 통계 · 0x4ec8a `0x22e10` 기록 달성 횟수 — 모드를 가리지 않는다
      recordStat({ kind: 'G획득', mode: PITCHER_LEAGUE_MODE, amount: gamePointReward })
      recordStat({ kind: '기록달성', recordIds: summary.recordIds ?? [] })
      // 하루 끝 b8216 — 다음 날 사람 경기 상대를 +0xbe0 에 마스터에서 새로 복사. 대회 칸(L+0xa8~ · L+0x32)은 정산 끝 0x4f3c4 가 저장
      commitWith((current) => ({
        ...settleNariCupGame(current, gamePointReward),
        nationalCup: next,
        ...(current.nariCupTeams === undefined
          ? {}
          : { nariCupTeams: nextNariCupDayTeams(current.nariCupTeams, nationalCupMatchupOf(next)?.opponent ?? null) }),
      }))
      setGameOptions(null)
      setCupMatch(null)
      setCupView({ cup: next, atStandings: false })
      setScene('국가대항전')
    },
    [commitWith, random, recordStat],
  )

  const finishGame = useCallback(
    (summary: PitcherGameSummary) => {
      if (career === null || gameOptions === null) return
      // 국가대항전 경기는 커리어 정산을 타지 않고 대회 하루를 넘긴다 (142 → 경기 → 101 → 134)
      const cupGame = cupGameRef.current
      if (cupGame !== null) return finishCupGame(summary, cupGame, gameOptions)
      // 경기 장면 0x104 를 지나 나리 장면이 새로 선다 — 장면+0x288 = 0
      matchPreparedRef.current = false
      // 정산 진입 0x4ea0c 의 0x4f3d6 — 전역기록 +0x4c + 모드(+0x4f) = 0
      nariGameSaveRef.current?.clear()
      // 기록 달성 G 는 요약이 들고 온다 (0xa77f0 → 0x4ea0c). 강판당한 경기는 원본이 전면 차단해 0 이다
      const outcome = pitcherGameOutcomeOf(summary, gameOptions, {
        entered: summary.hasEntered,
        gamePointReward: recordGamePointsOf(summary.recordIds),
      })
      // 두 팀 투수 레코드 +0x2c 는 경기 끝 값이 리그 표에 남는다 (준비 0x1c46c 가 g == 0 이면 열 팀 10000 으로 채운 뒤)
      // 동료·상대 CPU 투수 줄과 경기 끝 판정은 리그 기록표에 (정산 0xa8024 · 0xa7de8 — 정규시즌만, 내 투수 빼고)
      const recorded = withPitcherGameLeagueRecords(
        career,
        withPitcherGameStaminas(
          career,
          applyPitcherGameResult(career, outcome),
          gameOptions.ourTeamId,
          gameOptions.opponentTeamId,
          summary.pitcherStaminas,
        ),
        summary.leaguePitchers,
      )
      // 경기 끝 0x4ea0c: 기록 달성 G 를 저장 G 에 더한 뒤 0x4ec82 `0x22c7d(액수, 모드 3)` 로 획득 GP 통계에 적는다
      recordStat({ kind: 'G획득', mode: PITCHER_LEAGUE_MODE, amount: outcome.gamePointReward })
      // 이어서 0x4ec8a `0x22e10` 이 이번 경기 기록 배열 40칸을 연감 달성 횟수 [+4+n] 에 더한다 (e48e922)
      recordStat({ kind: '기록달성', recordIds: summary.recordIds ?? [] })
      const day = applyPitcherLeagueDay(recorded, random, aceLevels)
      // 45경기째면 하루 끝(0xb818c)이 정규시즌을 닫고 대진(0xb80a8)을 연다. CPU 끼리의 포스트시즌 경기는
      // 여기서 돌리지 않는다 — 원본은 대진 128 의 [확인](0x13da0)에서 돌린다 (`pressPostseasonBracket`)
      const seasoned = applyPitcherSeasonEnd(day)
      /*
       * 경기 뒤 평가 0xa719c(인기도 0xa690c → 평판 0xa6218 → 사기)는 **정규시즌 경기만** 탄다. 유일한 호출지
       * 0x4ea0c 안 0x4f274 앞에서 0x4f216(L+0xac 국가대항전)·0x4f268(L+0x34 포스트시즌)이 0x4f29a(하루 끝)로
       * 건너뛰고, 이 갈래에는 모드 갈림이 없다(0x4f1a2 의 모드 2 곁가지 뒤 0x4f216 으로 합류) → 모드 3 도 같다.
       * 포스트시즌 표시는 45번째 경기의 하루 끝(0xb818c → 0xb80a8)에야 서므로 그 경기는 평가된다 —
       * 경기 전 커리어(`career.postseason`)로 가른다. (웹 투수편엔 국가대항전이 없다.)
       */
      const isEvaluated = career.postseason === null
      const evaluated = isEvaluated
        ? gainPitcherMorale(
            gainPitcherReputation(
              gainPitcherPopularity(seasoned, summary.evaluation.popularityChange),
              summary.evaluation.reputationChange,
            ),
            summary.evaluation.moraleChange,
          )
        : seasoned
      // 선발형 승리 완투 계열 → +0x1e0/+0x1f0 (0xa690c 안이라 평가가 도는 정규시즌 경기만)
      const completed = isEvaluated ? countCompleteGame(evaluated, summary.evaluation.countedCompleteGame) : evaluated
      // 평가가 돈 경기만 S+0x4a · +0x64 · +7 을 덮는다 — 포스트시즌 경기 뒤 116 은 앞 경기 값을 다시 읽는다
      const withEvaluation: PitcherCareer = isEvaluated
        ? {
          ...completed,
          lastEvaluation: {
            popularityChange: summary.evaluation.popularityChange,
            reputationChange: summary.evaluation.reputationChange,
            moraleChange: summary.evaluation.moraleChange,
          },
        }
        : completed
      const lastEvaluation = withEvaluation.lastEvaluation ?? NO_LAST_EVALUATION
      /*
       * 기록 줄 S+0x1d8 — 쓰는 곳은 평가 0xa719c 의 모드 3 갈래(a7264~a72da: memset 8 뒤 [0] R+0x124 · [1] R+0x13c · [2] R+0x128 ·
       * [3] R+0x134 · [4] R+0x144+R+0x148 · [5] R+0x12c · [6] R+0x140, 모두 strb)뿐이다(0x1d8 상수를 만드는 자리 전수 — 그 밖은 다른
       * 객체). 포스트시즌 경기는 0x4f268 이 평가를 건너뛰므로 **116 은 앞 평가 경기(정규시즌 마지막 경기)의 줄을 다시 읽는다** —
       * 기록 줄 · 감독 글 38 의 [6] · 0x8a6fc 의 새가슴/더티볼 모두. 원본 그대로. 옛 저장에 앞 줄이 없으면 이 경기 값.
       */
      const thisLine = {
        decisionCode: summary.decisionCode & 0xff,
        outs: summary.record.outsRecorded & 0xff,
        runs: summary.record.runsAllowedField & 0xff,
        strikeouts: summary.record.strikeouts & 0xff,
        walksAndHitByPitch: (summary.record.walksAllowed + summary.record.hitByPitch) & 0xff,
        hitsAllowed: summary.record.hitsAllowed & 0xff,
        pitches: summary.pitchCount & 0xff,
      }
      const line = isEvaluated || career.lastGame === undefined ? thisLine : career.lastGame
      /*
       * 116 진입 0x1278c — 감독 글은 116 이 고른다: 모드 3 표 [−2…6](선발형이면 칸 3~8 두 배, 0x1285a)에서 +0x4a 칸 · 평판 +0x62
       * (평가 뒤 값) 구간(0x128d2) · 38 은 보직(0xb6705) ≠ 0 && state+0x6a == state+0x6b(이 경기) && S+0x1d8[6](투구 수) == 0
       * (12ac4~12afe). 기록 줄은 S+0x1d8 (12a3c~12ac0).
       */
      const neverEntered = gameOptions.role !== PITCHER_ROLE.starter
        && reliefNeverEnteredOf(summary.endedInningIndex)
        && ((line.pitches ?? 0) & 0xff) === 0
      const lastGame: PitcherLastGame = {
        decisionCode: line.decisionCode,
        outs: line.outs,
        runs: line.runs,
        strikeouts: line.strikeouts,
        walksAndHitByPitch: line.walksAndHitByPitch,
        hitsAllowed: line.hitsAllowed,
        pitches: line.pitches,
        managerCommentIndex: managerCommentIndexOf(
          {
            role: gameOptions.role,
            neverEntered,
            reputation: withEvaluation.reputation,
            positionCode: gameOptions.positionCode,
          },
          lastEvaluation.popularityChange,
        ),
      }
      // 연속 기록 +0x1bc — 0xa719c 모드 3 갈래라 평가가 도는 정규시즌 경기만 잇는다 (`advancePitcherStreaks`)
      const streaks = isEvaluated
        ? advancePitcherStreaks(career.streaks ?? EMPTY_PITCHER_STREAKS, {
          role: career.role,
          dayCounter: leagueDayCounterOf(career),
          endedInningIndex: summary.endedInningIndex,
          decisionCode: summary.decisionCode,
          strikeouts: summary.record.strikeouts,
        })
        : withEvaluation.streaks
      // 전역 경기 상태 +0x6b 에 이 경기 끝 이닝이 남는다 (이어하기 116 의 감독 글 38 판정이 본다)
      setLiveGameInningIndex(summary.endedInningIndex ?? 0)
      setGameOptions(null)
      // S+0x50 = 2 · 저장 → 평가 창 → 경기 뒤 카운터 → 저장, 평가 징글 (`enterPitcherGameEvaluation`)
      commit(enterPitcherGameEvaluation({ ...withEvaluation, lastGame, streaks }))
      playSoundIds(activeSound(), [pitcherEvaluationJingleIdOf(lastEvaluation.popularityChange)])
      setScene('경기결과')
    },
    [aceLevels, career, commit, finishCupGame, gameOptions, random, recordStat],
  )

  /**
   * 116 [확인] → 114 — 0x8a6fc 가 쌓은 평가 내장 이벤트를 틀고, 114 진입 0x11d00 이 S+0x50 = 2 → 3(웹 null), 116 의 끝
   * (0x12b74~0x12bb2)이 고른 뒤 상태로 간다.
   */
  const confirmGameResult = useCallback(
    () => {
      if (career === null) return
      // 116 → 114: 0x8a6fc 가 쌓은 내장 이벤트를 114 가 틀며 연속 기록 보상 명령(평판 · 집중/새가슴/더티볼)을 먹는다 —
      // 이어하기로 116 을 다시 띄웠으면 또 먹는다(원본 그대로, 타자편 `streakEventOf` 와 같은 자리)
      const rewarded = career.seasonEndState === 116
        ? applyPitcherEventRewards(career, pitcherStreakEventOfCareer(career).rewards)
        : career
      const counted: PitcherCareer = { ...rewarded, seasonEndState: null }

      /*
       * 포스트시즌 경기 뒤 — 116 의 끝(0x12b74~0x12b94)이 S+0xb4 ≠ 0 이면 **S+0xb2(= L+0x32) == 0 → [114 → 136],
       * 아니면 [114 → 128]** (R9 116절, 모드 갈림 없음). 관리 주기·부상 엔딩·중간평가를 타지 않는다.
       * 내 시리즈가 끝난 경기는 0xb7724 가 L+0x32 = −1(b777a), 하루 끝 0xb818c(0x4f29c)가 +1 → 0 이라 136 부터 사슬을
       * **다시 돈다** — 136 진입 0x10bb0 이 0x8bdc9(392) 를 본 표시 없이 다시 튼다(0x8bdc8 → 0xae170). 원본 그대로다.
       * 45번째 경기는 경기 전 대진이 없어 아래 시즌종료로 간다(그때도 L+0x32 = 0 → 136 이다).
       */
      if (counted.postseason !== null) {
        if (leagueDayCounterOf(counted) === 0) {
          // 114 진입 0x11d00 이 2 → 0xb(포스트시즌 g == 0) — 136 진입이 다시 쓴다 (웹 null)
          commit(counted)
          return setScene('시즌종료')
        }
        // 128 진입 0x120a4 — S+0x50 = 0xf · 저장
        commit({ ...counted, seasonEndState: 128 })
        setPostseasonPopup(regularSeasonPopupOnEnter(counted))
        return setScene('포스트시즌')
      }
      // 경기 뒤 평가 116 의 끝 — 정규시즌이 닫혔으면 시즌 끝 사슬(136→…→132)로 간다.
      // 45경기를 다 치렀는지는 `isPitcherSeasonFinished`(0xb818c) 가 본다.
      if (isPitcherSeasonFinished(counted)) {
        commit(counted)
        return setScene('시즌종료')
      }
      /*
       * **2경기 주기** — 상태 116 의 끝(0x12b74~0x12bb2)이 `S+0xb2`(경기 수)의 **비트0** 을 본다:
       * ```
       *   12b98: ldrb r3,[r2]        ; r2 = S+0xb2 = 경기 수 g
       *   12b9a: movs r1,#0
       *   12b9c: lsls r5,r3,#0x1f    ; 비트0 을 부호 자리로
       *   12b9e: bmi  0x12ba2        ; 홀수면 건너뜀
       *   12ba0: movs r1,#1          ; 짝수
       *   12ba8: cmp  r1,#0 ; beq 0x12bb0
       *   12bac: movs r1,#0x69       ; 105 관리 화면
       *   12bb0: movs r1,#0x6d       ; 109 순위표
       * ```
       * 이 함수에는 **모드 갈림이 없다** — 장면 0x106 은 모드 3(투수편)·4(타자편)가 함께 쓰므로
       * 투수편도 타자편과 **똑같이 2경기 주기**다 (재진입 분기 0x1c38e~0x1c3b8 도 같은 판정).
       * 홀수 경기 뒤는 109 순위표로 간다 — 타자편(`useCareerSession.confirmGameResult`)과 같다
       * (원본 109 → 142 → 144 → 경기 장면. 웹은 142·144 없이 109 확인이 곧바로 경기).
       *
       * ⚠️ **부상 엔딩 판정보다 앞에 둔다** — 부상 엔딩은 관리 화면 **진입**(105, 0x11910 → 0x11b32)의
       *    첫 줄이라, 홀수 경기 뒤에는 105 에 들르지 않아 원본에서도 굴러가지 않는다.
       */
      if (!isPitcherManagementCycleOpen(counted)) {
        // 116 → [114 → 109] 순위표 (이전 상태가 105 가 아니라 취소가 안 먹는다). 109 진입 0x10d8c 가 S+0x50 = 4 · 저장
        commit({ ...counted, seasonEndState: 109 })
        setNextGameFromManagement(false)
        return setScene('다음경기순위')
      }
      // 관리 화면 진입 105(0x11910 → 0x11b32)의 첫 줄 — 부상 누적 20경기면 이벤트 500 → 엔딩 141 (B-7). 그 검사는 105 에
      // 들어올 때마다 도는 진입 곁가지라 관리 화면 도착 고리(아래 '관리 화면(105)의 이벤트')가 한다
      commit(counted)
      setScene('관리')
    },
    [career, commit],
  )

  /** 새 시즌 처리 0x1b768 → 137 "N년차" 표지 → 105 관리 화면 (웹은 표지를 건너뛴다) */
  const startNewSeason = useCallback(
    (finished: PitcherCareer) => {
      commit(startNextPitcherSeason(finished))
      setScene('관리')
    },
    [commit],
  )

  /**
   * 엔딩 141 로 — 진입 0x12300 은 S+0x50 = 6 을 메모리에만 쓰고 커리어를 저장하지 않는다(저장은 엔딩 칸을 비운 채 —
   * `savedCareerOf`). 보너스는 팝업 0x2b 를 닫을 때 준다(`receiveEndingBonus`)
   */
  const enterEnding = useCallback(
    (finished: PitcherCareer, endingIndex: number) => {
      commit({ ...finished, endingIndex })
      setScene('엔딩')
    },
    [commit],
  )

  /**
   * 엔딩 보너스 팝업 0x2b 를 닫았다 — 141 틀 0x1bbc4 의 1bbf4~1bc70(모드 3 · 4 공용): 보너스 0xcc40c[e] × 1000 을 전역 G 에 더하고
   * `0x22c7d(보너스, 모드 3)` 통계 · 전역기록 저장 · **S+0x7b = 1** · 커리어 저장(S+0x50 = 6 째 — 다시 켜면 141, `pitcherResumePointOf`)
   */
  const receiveEndingBonus = useCallback(() => {
    if (career === null || career.endingIndex === null || career.endingBonusReceived === true) return
    const endingIndex = career.endingIndex
    commit({ ...applyPitcherEndingBonus(career, endingIndex), endingBonusReceived: true })
    recordStat({ kind: 'G획득', mode: PITCHER_LEAGUE_MODE, amount: pitcherEndingBonusOf(endingIndex) })
  }, [career, commit, recordStat])

  /** 연말 사슬의 이벤트 하나를 튼다 — 들어가기 전에 상태 함수가 하는 일(375 앞 MVP 판정 131)을 먼저 */
  const openYearEndEvent = useCallback(
    (current: PitcherCareer, eventId: number, viewed: readonly number[]) => {
      commit(enterPitcherYearEndEvent(current, eventId))
      openStory({ eventId, context: '연말', viewed })
    },
    [commit, openStory],
  )

  /**
   * 연말 사슬의 다음 걸음 — 이번 연말에 본 이벤트 전부(`viewed`)로 고른다 (`nextPitcherYearEndStep`).
   *
   * ```
   *   136 392 → 393~396 · 130 370 → 371~374 · 131 375 → 376/377 · (128 포스트시즌 — 아래 ⚠️)
   *   132 501(방출)/504(은퇴식) → 141 · 502 → 380/496 · 380 → 381/382 → 384~391 / 383
   *       줄 [114 → 133] — 연차idx 짝수(1·3·5·7·9·11년차)면 0x10cec 가 133 을 뒤 상태로 넣는다
   *   133 0x1a090: 0xa3de9(S, 3) > 3 → 461(선발) → 463 출전 / 464 거절 · 아니면 462(탈락)
   *   114 끝 0x1c014: 뒤 == 132 → 새 시즌 0x1b768 → 137 → 105
   * ```
   * 국가대표 판정의 목표 단계 3 은 투수 갈래(0xa3e56 표 그대로)다 — `achievedPitcherGoalCount(_, '국가대표')`.
   *
   * ⚠️ 미해결·근사 (타자편 `useCareerSession.continueSeason` 과 같은 자리):
   *   - 463 출전 → 134 국가대항전 대진판 → 135 → 142 → 대표팀으로 던지는 경기 → 결과·보상 → 새 시즌 (8eceab3).
   *   - 462 탈락: 원본은 뒤 = 105 로만 적혀 있고 새 시즌 처리가 안 보인다 — 타자편과 같이 새 시즌으로 넘긴다.
   *   (128 포스트시즌 대진은 131 과 132 사이 — 아래 `pressPostseason` · `closePostseasonPopup`)
   */
  const continueYearEnd = useCallback(
    (current: PitcherCareer, viewed: readonly number[], endingRequested = false) => {
      if (viewed.includes(NATIONAL_CUP_EVENT.출전)) {
        // 463 출전 — 상태 133 이 0xb7bf1(L) 로 대회를 세우고(+0xbc4 대표팀 마스터 복사 · +0xbe0 첫날 상대) 모드 3 갈래
        // 0xb521d(대표팀, 내 투수, 1) 로 내 칸 k 에 내 투수 복사본을 넣고 134 를 줄에 넣는다. 134 의 틀 0x1b92c 머리가 들어온
        // 첫 틀에 비트 8 이 없으면 칭호 8 "국가 대표" 를 준다 (장면 0x106 은 모드 3·4 공용)
        const nationalTitle = nationalCupStandingsTitleOf(current.titleIds)
        const titled = nationalTitle === null ? current : awardPitcherTitles(current, [nationalTitle])
        // 463 보상 뒤 0x8cca2 — S+0x50 = 3(웹 null) · S+0x12c = 1, 0x8cd44 저장. 대회 칸(0xb7bf1)은 133 이 세운 그대로 파일에 든다
        const entered = withPitcherNationalCupEntered(titled)
        const cup = entered.nationalCup ?? createNationalCup()
        commit(entered)
        setCupView({ cup, atStandings: false })
        return setScene('국가대항전')
      }
      // 464 거절은 S+0x12c = 0 으로 곧 새 시즌 (P5) · 462 탈락은 근사 (위 머리글)
      if (viewed.includes(NATIONAL_CUP_EVENT.거절) || viewed.includes(NATIONAL_CUP_EVENT.탈락)) {
        return startNewSeason(current)
      }
      const step = nextPitcherYearEndStep(current, viewed, endingRequested)
      if (step.kind === '포스트시즌') {
        // 131 뒤 128 진입 0x120a4 — 정규시즌 우승 보상을 아직 안 받았고 1위면 팝업 0xb
        yearEndViewedRef.current = viewed
        // 진입 0x120a4 — S+0x50 = 0xf · 저장 (이어하기는 S+0xb4 갈래로 128 에 돌아온다)
        commit(current.seasonEndState === 128 ? current : { ...current, seasonEndState: 128 })
        setPostseasonPopup(regularSeasonPopupOnEnter(current))
        return setScene('포스트시즌')
      }
      if (step.kind === '이벤트') return openYearEndEvent(current, step.eventId, viewed)
      if (step.kind === '엔딩') return enterEnding(current, step.endingIndex)
      // 연차idx 는 **끝난 해**의 것이라 새 시즌을 올리기 전에 본다 (0x10ce6~0x10cf8)
      if (isCareerNationalCupYear(current.season - 1)) {
        const eventId = careerNationalTeamEventId(achievedPitcherGoalCount(current, '국가대표'))
        return openYearEndEvent(current, eventId, viewed)
      }
      startNewSeason(current)
    },
    [commit, enterEnding, openYearEndEvent, startNewSeason],
  )

  /** 시즌 끝 화면 [다음] → 136 의 이벤트 392 "올해의 목표" 부터 연말 사슬을 튼다 */
  const beginYearEnd = useCallback(() => {
    if (career === null) return
    continueYearEnd(career, [])
  }, [career, continueYearEnd])

  /** 502 "연봉 협상한다 (다음연차 진행)" → 380 (502 의 선택지 gotoEvent) */
  const continueCareer = useCallback(() => {
    if (career === null) return
    openYearEndEvent(career, SALARY_EVENT_ID, [RETIREMENT_CHOICE_EVENT_ID])
  }, [career, openYearEndEvent])

  /** 502 "은퇴한다" → 496 "정말로 은퇴하려는 거냐?" (→ 503 → 엔딩 141 / → 380) */
  const retire = useCallback(() => {
    if (career === null) return
    openYearEndEvent(career, RETIREMENT_CONFIRM_EVENT_ID, [RETIREMENT_CHOICE_EVENT_ID])
  }, [career, openYearEndEvent])

  /** 엔딩 141 의 팝업 0x32 — 5000 G포인트로 이어하기 */
  const continueAfterEnding = useCallback(() => {
    if (career === null || career.endingIndex === null) return false
    if (!canContinueAfterPitcherEnding(career, career.endingIndex)) return false
    commit(continueAfterPitcherEnding(career))
    // 팝업 0x32 예 → 0x1bdc6 `0x22c29(모드 3 → 2, 5000)`
    recordStat({ kind: 'G사용', usage: leagueUsageOf(PITCHER_LEAGUE_MODE), amount: PITCHER_CONTINUE_COST_GAME_POINT })
    setScene('관리')
    return true
  }, [career, commit, recordStat])

  /**
   * 엔딩을 떠나 메인 메뉴로 (직접 떴다). 커리어 저장을 지우는 곳은 **명예의 전당 등록** 하나다 — 0x62d40~0x62d7e 의 투수 갈래가
   * 선수 사본(0x1f655) 뒤 `0x224ec(저장, 3)`(모드 저장 지우기 — +0x43 · +0x4f = 0, 투수편 저장 칸을 비운다)를 부른다.
   * 팝업 0x2d · 0x32 "아니오"는 `[this+0x278] = 1` · 화면 전환뿐이고 그 끝 1bfa2~1bfe2 는 장면 0x103(메인 메뉴)으로 나갈 뿐이라
   * 저장이 남는다. 다시 들어오면 장면 0x106 이 새로 서 100 → 0x1c154 가 **남은 저장으로** 이어한다(보너스를 받은 저장이면 141).
   * 웹은 세션이 앱 동안 살아 있어, 등록 없이 떠나면 그 자리에서 저장을 다시 읽어 이어할 자리를 고른다(`pitcherResumeOf`).
   */
  /**
   * 명예의 전당 등록이 된 그 순간 — 0x62dbe 의 0x224ec(저장, 3): 모드 저장을 지운다(경기 중간 저장 칸도). 원본은 등록 완료 창을
   * 닫기 전에 지우므로 그 창에서 앱을 꺼도 저장은 없다.
   */
  const eraseSaveForHallOfFame = useCallback(() => {
    isSaveErasedRef.current = true
    // 저장소에 `clear` 가 없어 **이름 없는 빈 덩어리**를 덮어쓴다 — `normalizePitcherCareer` 가 null 로 읽는다
    nariGameSaveRef.current?.clear()
    store.save({})
  }, [store])

  const finishEnding = useCallback((isRegistered: boolean) => {
    setGameOptions(null)
    if (isRegistered) {
      // 저장은 등록하는 순간 지웠다 (`eraseSaveForHallOfFame`)
      isSaveErasedRef.current = false
      setCareer(null)
      setScene('등록')
      return
    }
    /*
     * 등록 없이 떠남 — 141 끝 1bfa2~1bfe2 는 화면 전환 · 0x375d · [0x140006c] = 5 · 장면 0x103 뿐(저장 없음)이고, 다음에 투수편으로
     * 들어오면 장면 0x106 이 새로 서며 100 → 0x1c154 가 그 저장으로 이어한다. 웹 세션은 앱 동안 살아 있어 여기서 미리 같은 저장으로
     * 고른다 — 그 사이 투수 저장을 쓰는 곳은 이 세션뿐이고(지갑 다리는 같은 커리어를 다시 쓸 뿐), 이 자리의 이어할 자리(엔딩 141 ·
     * 연말 사슬 이벤트)는 굴림 · 저장 · 소리가 없다. 105 진입 곁가지(부상 엔딩 · 나간 대결 140 · 115 · 훑기 굴림)는 들어와 관리 장면에
     * 닿을 때 도는 도착 고리(`isOnScreen` — 투수편 화면일 때만)라 원본 진입 때와 같은 차례다.
     */
    const next = pitcherResumeOf(normalizePitcherCareer(store.load()))
    resumed.current = next
    replayedEvaluationRef.current = false
    resumedNewSeasonRef.current = false
    setResumePoint(next.point)
    setCareer(next.career)
    setScene(pitcherSceneOfResume(next.career, next.point))
    setStory(pitcherStoryOfResume(next.point))
    setPostseasonPopup(postseasonPopupOfResume(next.career, next.point))
    setCupView(cupViewOfResume(next.point))
  }, [store])

  const goto = useCallback((next: PitcherScene) => setScene(next), [])

  /**
   * **경기 중 메뉴 "나가기"** — 경기 상태 0x22 갱신 `0x40140` 은 모드를 가리지 않고 0x140006c = 4 · 장면 0x103(메인 메뉴 처음 단)으로
   * 나간다. 저장(0x22754)도 전역기록 +0x4f 도 안 건드린다 — 142 확인 0x13cca 가 세운 +0x4f 가 남아 [14]·[최근게임] 의
   * 0x327b8 모드 3 갈래가 곧장 경기(`resumeInterruptedGame`)로 다시 세운다.
   * 장면 0x106 은 나갈 때 헐리고 다음에 새로 서므로, 웹은 세션 장면을 새로 선 장면의 이어하기(상태 100 진입 0x1c154 —
   * `pitcherResumePointOf`)로 되돌려 둔다. ⚠️ 웹 전용 갈래: +0x4f 손잡이가 없어 곧장 경기가 안 될 때만 이 장면이 보인다.
   */
  const quitGame = useCallback(() => {
    // ⚠️ 원본은 나간 그 이닝이 +0x6b 에 남는다(0x40140 은 상태를 안 지운다) — 웹 투수 경기 화면(pages/pitching)이 지금 이닝을 넘기지
    // 않아 경기 시작 때의 0 이 남는다 (미해결)
    setGameOptions(null)
    setNextGameFromManagement(false)
    matchPreparedRef.current = false
    if (career === null) return setScene('등록')
    const point = pitcherResumePointOf(career)
    if (point.kind === '이벤트') {
      setCareer(enterPitcherYearEndEvent(career, point.eventId))
      setStory({ eventId: point.eventId, context: '연말', viewed: [] })
      return setScene('이벤트')
    }
    // 1c25e — S+0x50 == 0x11 → 새 시즌 처리 0x1b768 (경기 중에는 이 값이 남지 않지만 같은 분기라 함께 둔다)
    if (point.kind === '새시즌') return startNewSeason(career)
    if (point.kind === '포스트시즌') setPostseasonPopup(regularSeasonPopupOnEnter(career))
    if (point.kind === '국가대항전') {
      // 그 밖 갈래 S+0x12c → 134 대진판 (1c348~1c358)
      cupGameRef.current = null
      setCupMatch(null)
      setCupView({ cup: point.cup, atStandings: false })
    }
    setScene(point.kind)
  }, [career, startNewSeason])

  /**
   * 내보이는 커리어의 G 는 **지갑 값**이다 (원본 `mgr[+0x64]` 한 칸). 관리 화면 뱃지·구질 훈련
   * 가격 판정·지옥훈련 가드가 다 이 `career.gamePoint` 를 읽으므로, 여기서 한 번 갈아 끼우면
   * **보여 주는 값과 판정이 같은 값**을 본다.
   *
   * ⚠️ **테스트용** — `?무한G` 는 지갑 쪽에서 처리한다 (`useGamePointWallet`): `balance` 가 늘
   *    99999 이고 쓰기는 먹히지 않는다. 지갑을 안 받은 자리(테스트)는 예전처럼 여기서 올린다.
   *    저장은 그대로라 스위치를 끄면 원래 값으로 돌아온다.
   *
   * ⚠️ **값이 같으면 `career` 를 그대로 돌려준다** — 타자편 `useCareerSession` 과 같은 이유다.
   *    G가 어긋나 갈아 끼울 때 매 렌더 **새 객체**를 만들면, 이 값을 프로프로 받는 화면이
   *    아무것도 안 바뀌었는데도 계속 새 객체를 보게 된다. `useCareerSession` 에서는 그 새 객체가
   *    저장 고리를 다시 돌려 **무한 렌더**까지 갔다 — 여기 고리들은 `career`(상태) 쪽을 보므로
   *    지금은 안 돌지만, 같은 모양을 남겨 둘 까닭이 없다.
   */
  const overriddenGamePoint = wallet?.balance ?? (isInfiniteGamePointOn() ? MAXIMUM_GAME_POINT : null)
  const shown = useMemo(
    () =>
      career === null || overriddenGamePoint === null || career.gamePoint === overriddenGamePoint
        ? career
        : { ...career, gamePoint: overriddenGamePoint },
    [career, overriddenGamePoint],
  )

  const [shopTab, setShopTab] = useState<PitcherShopTab>('장착')
  const [shopNotice, setShopNotice] = useState('')
  const [shopGpDetail, setShopGpDetail] = useState<GpDetailOf<PitcherCareer> | null>(null)
  const closeShopGpDetail = useCallback(() => setShopGpDetail(null), [])

  /** [아이템] → 110 → 111 장비 상점 · [선수정보] → 121 장비착용. 취소는 `goto('관리')` — 관리 화면이 하위 메뉴로 선다(원본 111 → 110) */
  const openShop = useCallback((tab: PitcherShopTab) => {
    setShopTab(tab)
    setShopNotice('')
    setShopGpDetail(null)
    setScene('상점')
  }, [])

  /**
   * 장비·서브·GP 구매와 장비 착용. 바뀐 칸이 커리어에 들어가고 곧바로 저장한다
   * (원본 0x14a74 도 `0x22755(app, 1)` 로 바로 저장한다).
   * 해금표는 원본에서 전역이라 기록연감 것을 커리어 것에 얹어 판정하고, 얹은 채로 저장한다
   * (타자편 `syncOpenedHidden` 과 같은 방식).
   *
   * GP 아이템은 G 를 쓰고(전역 `mgr+0x64`) 또또상품권은 난수를 굴리므로 **한 번만** 고른다 —
   * 보이는 커리어(`shown`, G = 지갑 값)로 고르고 그 결과를 그대로 저장하면, 바뀐 G 는 지갑 다리가 지갑으로 옮긴다
   * (구질 훈련·마구 훈련이 G 를 쓰는 길과 같다).
   */
  const purchase = useCallback(
    (itemId: string, globalOpenedHiddenIds: readonly number[] = []) => {
      if (career === null || shown === null) return
      const missing = globalOpenedHiddenIds.filter((id) => !shown.openedHiddenIds.includes(id))
      const merged = missing.length === 0 ? shown : { ...shown, openedHiddenIds: [...shown.openedHiddenIds, ...missing] }
      const selection = selectPitcherShopItem(merged, itemId, random)
      setShopNotice(selection.notice)
      setShopGpDetail(selection.detail ?? null)
      if (selection.career === merged) return
      // G 를 안 쓴 칸(장비·서브·착용)은 저장의 G 칸을 건드리지 않는다 — `?무한G` 의 99999 가 저장에 새지 않게
      const spentGamePoint = selection.career.gamePoint !== merged.gamePoint
      commit(spentGamePoint ? selection.career : { ...selection.career, gamePoint: career.gamePoint })
      // GP 칸 구매 확정 — 0x14ffe `0x22e35(모드 3, 칸)` → 0x1501e `0x22c29(2, 가격)` (가격 표는 두 편 공용)
      const [tab, first] = itemId.split(':')
      if (tab === 'GP' && spentGamePoint) {
        const index = Number(first)
        recordStat({ kind: 'GP아이템구매', mode: PITCHER_LEAGUE_MODE, index, price: BATTER_GP_ITEMS[index].price })
      }
    },
    [career, commit, random, recordStat, shown],
  )

  /**
   * 관리 화면(구질 훈련 창 포함)이 계산해 돌려준 커리어를 저장한다 — `actions.save`.
   *
   * 이 길로 G 가 줄어드는 것은 세 가지뿐이고, 원본은 셋 다 G 를 뺀 뒤 `0x22c29(모드 3 → 2, 비용)` 로 투수편 소모 GP 에 적는다:
   * 슬롯 확장(0x148d8) · 마구 훈련(훈련 적용 0xa3bac 종류 4 → 0xa3cac) · 구질 훈련(종류 5 → 0xa3d76).
   * 화면 쪽(관리 메뉴·구질 훈련 창)은 다른 작업 구역이라 여기서 보이는 G 와 견줘 줄어든 만큼을 적는다
   * (세 길 모두 G 가 모자라면 막혀 0 으로 잘리는 일이 없어 줄어든 값 = 비용).
   */
  const saveFromScreen = useCallback(
    (next: PitcherCareer) => {
      const spent = shown === null ? 0 : shown.gamePoint - next.gamePoint
      commit(next)
      if (spent > 0) recordStat({ kind: 'G사용', usage: leagueUsageOf(PITCHER_LEAGUE_MODE), amount: spent })
    },
    [commit, recordStat, shown],
  )

  /**
   * **외출 (상태 112 지도 → 113 장소 → 126 기능)** — 원본 모드 3 은 타자편과 같은 상태·같은 코드를 돈다
   * (105 칸 3 = 0x126be → 0x70, 진입 0x118e4 · 키 0x13ba4 · 0x16c64 · 효과 0x15234 · 입원 회복 0x1575c 에 모드 갈림 없음).
   * 그래서 지도·장소·효과 표·굴림 차례(인기도 → 평판 → 사기 → 입원이면 질병·부상)를 타자편 `runOuting` 그대로 쓴다.
   * 서브 아이템 5~9(`기록[0x5d+장소]`) 보정도 거기서 붙는다.
   *
   * 외출은 G 를 쓰지 않으므로 지갑 그림자(`shown`)가 아닌 저장 쪽 커리어로 돌리고 그대로 저장한다.
   * 126 흐름은 원본 그대로다 (두 편 같은 코드): 진입 0x11da8 → 연출 0x85074 (60 갱신, 확인 키 0x105c8 로 건너뜀)
   * → 연출 끝(0x84e58)에 효과 0x15234 가 굴리고 **효과 팝업**(StrMODE[22]·[23]·[25]·[24] 줄 + 서브 아이템 [195])을
   * 지도 위에 띄운다 → 팝업이 닫히면 틀 0x1575c 가 입원이면 회복을 굴려 **회복 글 팝업**을 띄우고 **105** 로 간다.
   * 그 사이 다른 굴림이 없어 웹은 고를 때 한 번에 굴린다 (차례 같음).
   * ⚠️ 미해결: 연출 그림(0x84ea0 — event_ani 애니 [1,0,2,4,3][장소] · event_char_1 +30 · event_char_0 +0x5d)은 아직 옮기지 않았다.
   */
  const [outingNotice, setOutingNotice] = useState('')
  const [outingResult, setOutingResult] = useState<OutingResult | null>(null)
  const [outingRecoveryNotice, setOutingRecoveryNotice] = useState('')
  /**
   * 112 진입(0x118e4) 횟수 — 늘 때마다 [!] 칸을 다시 찍는다(`outingSlots`). 105 → 112(`openOuting`) · 지도 자동 이벤트에서
   * 돌아옴(`뒤 112`) · 대결결과 140(105 진입 0x11910 의 0x11bb2 가 0x118e4 를 부른다)에서 는다. 장소(113)에서 돌아오는 길은 아니다.
   */
  const [outingEntryCount, setOutingEntryCount] = useState(0)
  const enterOutingMap = useCallback(() => {
    setOutingEntryCount((count) => count + 1)
    // 0x8cdc0 은 머리 0x8cdd4 · 끝 0x8ce34 에서 reader+0x28 = 0 — 112 진입 뒤 자동 발동은 처음부터 훑는다
    cursorRef.current = 0
  }, [])
  enterOutingMapRef.current = enterOutingMap
  const openOuting = useCallback(() => {
    setOutingNotice('')
    setOutingResult(null)
    enterOutingMap()
    setScene('외출')
  }, [enterOutingMap])
  const runOutingFunction = useCallback(
    (functionId: string) => {
      if (career === null) return
      const outingFunction = OUTING_PLACES.flatMap((place) => place.functions).find(
        (candidate) => candidate.id === functionId,
      )
      if (outingFunction === undefined) return
      const reason = outingBlockReasonOf(career, outingFunction)
      if (reason !== null) return setOutingNotice(outingBlockTextOf(reason, outingFunction))
      const outcome = performOuting(career, outingFunction, random)
      commit(outcome.career)
      setOutingNotice('')
      setOutingResult({ effectText: outcome.effectText, recoveryText: outcome.recoveryText })
    },
    [career, commit, random],
  )
  const closeOutingResult = useCallback(() => {
    if (outingResult === null) return
    setOutingResult(null)
    setOutingRecoveryNotice(outingResult.recoveryText)
    setScene('관리')
  }, [outingResult])
  const dismissOutingRecoveryNotice = useCallback(() => setOutingRecoveryNotice(''), [])
  /**
   * 외출 지도 [!] 칸 [gfx+0x9c] — 112 진입 0x118e4 → 0x8cdc0 이 장소마다 파일 순서 첫 이벤트(대상 1·3, trigger 2~6)를
   * **들어설 때 한 번** 넣는다(`outingPlaceSlotsOf`). 지도 그림 0x7ed6c 의 [!] 와 [들어가기] 0x8ce58 이 다음 112 진입까지 이 값을 쓴다.
   * 모드 갈림이 없는 코드라 판정만 투수 갈래(`pitcherStoryScene`)로 본다. 무작위는 굴리지 않는다.
   * 이벤트 본문이 아직 안 왔으면 오는 때 찍는다.
   */
  const careerForSlotsRef = useRef(career)
  careerForSlotsRef.current = career
  const outingSlots = useMemo(() => {
    const current = careerForSlotsRef.current
    if (outingEntryCount === 0 || current === null || fileEvents === null) return EMPTY_OUTING_PLACE_SLOTS
    return outingPlaceSlotsOf((placeFrame) => pitcherPlaceEventOf(current, fileEvents, placeFrame))
  }, [outingEntryCount, fileEvents])
  const eventPlaceIds = useMemo(() => outingSlotPlaceIdsOf(outingSlots), [outingSlots])

  /**
   * **외출 지도(112)의 자동 발동** — 0x1cf9c 는 현재 상태가 112 일 때도 같은 훑기를 화면코드 112 로 돈다
   * (trigger 1: 10 "병원이…?" · 401 인기도 3000). 찾으면 `[다음 114, 뒤 112]` — 끝나면 지도로 돌아온다.
   * 웹의 '외출' 장면은 112 지도와 113 장소를 함께 그려, 효과 팝업이 떠 있지 않을 때를 112 로 본다.
   * 굴림은 105 와 같은 근사(들어올 때만 rand 를 넘긴다 — trigger 1 이벤트엔 무작위 조건이 없다).
   */
  const wasIdleAtMapRef = useRef(false)
  useEffect(() => {
    const isIdle =
      career !== null && scene === '외출' && story === null && outingResult === null && fileEvents !== null
    if (!isIdle) {
      wasIdleAtMapRef.current = false
      return
    }
    const isArrival = !wasIdleAtMapRef.current
    wasIdleAtMapRef.current = true
    const event = scanAuto(career, fileEvents, EVENT_TRIGGER.외출, isArrival ? random : undefined)
    if (event !== null) openStory({ eventId: event.id, context: '지도', viewed: [] })
  }, [career, fileEvents, openStory, outingResult, random, scanAuto, scene, story])

  /**
   * 113 칸 0 [들어가기] (키 0x16c64): `0x8ce59` 가 배정된 이벤트를 부르고, 없으면 이벤트 440+장소
   * (`0x8bdc9(0x1b8 + [+0xe0]+0x184)`)를 부르며 +0x167 = 1(빈 장소). 그리고 `[다음 114, 뒤 113]`.
   * 이 칸에는 행동·인기도 가드가 없다 (가드 0x16cf0 은 칸 1 장소 기능 쪽이다).
   */
  const enterOutingPlace = useCallback(
    (place: OutingPlace) => {
      if (career === null || fileEvents === null) return
      setOutingNotice('')
      // 0x8ce58 — 112 진입에 찍어 둔 그 장소 칸의 번호(다시 훑지 않는다), 비었으면 440 + 장소
      openStory({ eventId: outingSlots.get(place.id) ?? emptyPlaceEventId(place.frame), context: '장소', viewed: [] })
    },
    [career, fileEvents, openStory, outingSlots],
  )

  /** 380 "올해 네 연봉은 %s만 상승해서 %s만이다" — 0x8bc4c 가 상승분·새 연봉을 ×100 해서 금액 서식 0x55cf4 로 */
  const storyReplacementsFor = useCallback(
    (eventId: number): readonly string[] | undefined => {
      if (career === null || eventId !== SALARY_EVENT_ID) return undefined
      const offer = salaryOfferOf(career)
      return [formatOriginalMoney(offer.raise * MONEY_TEXT_SCALE), formatOriginalMoney(offer.salary * MONEY_TEXT_SCALE)]
    },
    [career],
  )

  /**
   * 이벤트 재생(114)이 끝났다 — 틀 0x1c014.
   * 보상은 재생기가 지나온 보상 명령(0x8c460, 모드 3 갈래 `applyPitcherEventRewards`)이고, 본 이벤트는 모두
   * 본 표시를 남긴다. 그 뒤 갈 곳은 뒤 상태(`story.context`)로 갈린다:
   *   장소     +0x167 == 0 → S+4 = 1(행동함) · S+0x6a(외출 수)++ → 105 / 빈 장소(440~444) → 113 (행동 안 씀)
   *   연말     다음 사슬 (`continueYearEnd`)
   *   그 밖    뒤 = 105
   * G 보상(종류 10)은 한 줄마다 0x8c6e2 `0x22c7d(값, 모드 3)` 로 획득 GP 통계에 적는다.
   */
  /**
   * 재생 끝(114 끝 0x1c014). `endingEventId` 는 첫 종류 21 로 끝난 이벤트(0x8d4ce — [0x1552adc] = 1)다: 그 이벤트만 본 표시를
   * 안 하고(0x8cf8c 를 안 지난다) 거친 다른 이벤트는 0x8b0e4 가 본 표시한다. 엔딩은 그 칸으로 간다(`nextPitcherYearEndStep`).
   */
  const completeStory = useCallback(
    (rewards: readonly EventReward[], viewedEventIds: readonly number[], endingEventId: number | null = null) => {
      if (career === null || story === null) return
      const rewarded =
        story.context === '연말'
          ? finishPitcherYearEndEvent(career, story.eventId, rewards)
          : applyPitcherEventRewards(career, rewards, random, story.eventId)
      const viewed = finishPitcherEvent(
        rewarded,
        endingEventId === null ? viewedEventIds : viewedEventIds.filter((id) => id !== endingEventId),
      )
      rewards
        .filter((reward) => reward.kind === EVENT_REWARD_KIND.G포인트)
        .forEach((reward) => recordStat({ kind: 'G획득', mode: PITCHER_LEAGUE_MODE, amount: reward.value }))
      const hiddenNotice = hiddenOpenNoticeOf(rewards)
      if (hiddenNotice !== '') setStoryNotice(hiddenNotice)
      setStory(null)
      if (story.context === '연말') return continueYearEnd(viewed, [...story.viewed, ...viewedEventIds], endingEventId !== null)
      if (story.context === '연초') {
        // 내장 이벤트라 본 표시는 없다. 목표 창이 닫히면 0x7fe90 이 S+0x1b7 = 1 (해마다 한 번)
        commit({ ...rewarded, hasSeenYearGoalWindow: true })
        return setScene('관리')
      }
      // 114 끝 1c088 — 뒤 상태가 113(장소)이 아니면 [0x1552adc](첫 종류 21 로 끝남)를 지우고 141(번호는 0x12300 이 판정).
      // 부상 엔딩 500(105 진입 0x113e8)이 이 길이다. 장소에서 끝난 종류 21 은 원본이 칸을 남겨 두고 105 · 112 틀 1d056 이
      // 141 로 보내지만, 종류 21 이벤트(500 · 501 · 503 · 504)는 대상 0 이고 장소 이벤트의 갈래도 그리로 안 이어져 닿지 않는다.
      if (endingEventId !== null && story.context !== '장소') {
        return enterEnding(viewed, judgePitcherEnding(viewed) ?? NO_ENDING_JUDGEMENT)
      }
      if (story.context === '지도') {
        // 114 끝 0x1c014 → 0x8b0e4(1c02e)의 0x8b12c — 112 에서 연 이벤트도 행동함(S+4)을 켜고 저장한다(외출 수는 113 몫)
        commit(withOutingEventActed(viewed, true, story.eventId))
        // `뒤 112` — 112 에 다시 들어서 0x118e4 가 [!] 칸을 다시 찍는다
        enterOutingMap()
        return setScene('외출')
      }
      // 140 → 뒤 105. 장소 끝 처리(행동·외출 수)는 대결로 **나갈 때** 이미 했다 (아래 `settlePlaceForAceMatch`)
      if (story.context === '대결결과') {
        commit(viewed)
        return setScene('관리')
      }
      if (story.context === '장소') {
        if (isEmptyPlaceEventId(story.eventId)) {
          commit(viewed)
          return setScene('외출')
        }
        commit(spendPitcherCycleAction({ ...viewed, outingsThisSeason: viewed.outingsThisSeason + 1 }))
        return setScene('관리')
      }
      commit(viewed)
      setScene('관리')
    },
    [career, commit, continueYearEnd, enterEnding, enterOutingMap, random, recordStat, story],
  )

  /**
   * 보상 명령 하나를 그 자리에서 준다 — 0x8c460 모드 3 갈래(`applyPitcherEventRewards`, 연말 사슬은 `finishPitcherYearEndEvent`).
   * 이벤트 번호는 그 명령이 든 이벤트다 — 연차 보정 0x8d508(393~396) · 중간평가 비트 0x8cbaa(452~454)가 [mgr] 의 지금 이벤트를 본다.
   * G 보상(종류 10)은 한 줄마다 0x8c6e2 `0x22c7d(값, 모드 3)` 로 적는다. 종류 7 의 히든 오픈 알림(0x62368 → 공용 창)은 재생
   * 화면이 그 명령의 알림 창으로 띄우고 확인까지 기다린다(`rewardNoticeOf` — 기다림 0x8daa0).
   *
   * **저장한다** — 0x8c460 은 모드 3 · 4 공용으로 항목을 다 준 뒤 본 표시(지금 이벤트 0xacf49 · 떠나온 줄 0x8b0e4) · 장소 행동함을
   * 하고 0x8b0e4 → 0x22755 로 저장한다(나리면 0x8cd44 에서 한 번 더 · 0x1f1b9, `markRewardedEvent`). 예전 웹은 "0x7fe90 · 재생
   * 끝이 저장한다" 고 보고 저장하지 않아, 이벤트 도중에 끄면 준 보상이 사라졌다.
   */
  const giveStoryReward = useCallback(
    (items: readonly EventReward[], eventId: number, viewedEventIds: readonly number[] = [eventId]) => {
      if (career === null || story === null) return
      const rewarded = story.context === '연말'
        ? finishPitcherYearEndEvent(career, eventId, items)
        : applyPitcherEventRewards(career, items, random, eventId)
      items
        .filter((reward) => reward.kind === EVENT_REWARD_KIND.G포인트)
        .forEach((reward) => recordStat({ kind: 'G획득', mode: PITCHER_LEAGUE_MODE, amount: reward.value }))
      const marked = markRewardedEvent(rewarded, storyEvents?.find((event) => event.id === eventId) ?? null, viewedEventIds)
      // 8cc1a 0x8b0e4 의 0x8b12c — 112(지도) · 113(장소)에서 연 이벤트면 440~444 를 빼고 행동함(S+4)을 켠 채 저장한다
      const acted = withOutingEventActed(marked, story.context === '지도' || story.context === '장소', eventId)
      // 8cc2e — 이벤트 번호로 이어하기 자리(S+0x50)를 고치고 8cd44 에서 다시 저장한다 (`withPitcherRewardResumePatch`)
      commit(withPitcherRewardResumePatch(acted, eventId, items))
    },
    [career, commit, random, recordStat, story, storyEvents],
  )

  const confirmStoryChoice = useCallback(
    (eventId: number, leftEventIds: readonly number[]) => {
      if (career === null || story === null) return
      const marked = markRewardedEvent(career, null, leftEventIds)
      // 0x8b0e4 는 늘 저장한다(8b160~8b16e) — 커리어가 안 바뀌어도 쓴다
      commit(withOutingEventActed(marked, story.context === '지도' || story.context === '장소', eventId))
    },
    [career, commit, story],
  )

  /**
   * 이벤트 system 창 답 0 — 0x7fe90(상자): 모드 2 가 아니면 [[상자+0x150]+0x1b7] = 1, 그리고 0x22755([0x1400054], 1) 저장.
   * 이미 켜져 있어도 원본은 저장한다 — 그때까지 준 보상이 든 커리어가 저장된다.
   */
  const confirmEventSystemWindow = useCallback(() => {
    if (career === null) return
    commit(career.hasSeenYearGoalWindow ? career : { ...career, hasSeenYearGoalWindow: true })
  }, [career, commit])

  /**
   * 경기 명령(r_event `match`) — 투수편 장소 이벤트 113·123·127·150·153·192·196·207·211·217·221·225·229 (대상 3).
   *
   * **대결 화면이 없을 때의 근사** (`abortStoryAtMatch`): 그때까지 지나온 보상·본 이벤트만 남기고 알림과 함께 105.
   * 장소 끝 처리(행동·외출 수)는 match 가 끝남을 돌려주는 자리라 그대로 한다. 결과 이벤트는 열리지 않는다.
   */
  const abortStoryAtMatch = useCallback(
    (carry: StoryCarry) => {
      if (career === null || story === null) return
      const rewarded = applyPitcherEventRewards(settlePlaceForAceMatch(career, story.context), carry.rewards, random, story.eventId)
      commit(finishPitcherEvent(rewarded, carry.viewedEventIds))
      setStory(null)
      setStoryNotice(PITCHER_MANAGEMENT_TEXT.notPorted)
      setScene('관리')
    },
    [career, commit, random, story],
  )

  /**
   * **마선수 대결** — SYS 8(0x8d734 → 0x8d764)이 `g[0x175] = team − 1`(투수편 미션 레코드 번호)를 적고 미션 장면으로 나간다.
   * 그때까지 지나온 보상·본 이벤트는 재생기가 들고(`carry`) 결과 이벤트로 넘긴다 — 타자편과 같은 꼴.
   * 이벤트 데이터의 team 은 16~20 뿐이라 투수 미션 16~20 "메디카·킹타이거·로제·크라이져·어거지죠" (목표 아웃) 에 떨어진다.
   * match 가 관리자에 "끝남"(1)을 돌려주므로 장소 이벤트였다면 0x1c014 의 장소 끝 처리(행동 · 외출 수)가 **나가는 자리에서**
   * 돈다 (`settlePlaceForAceMatch`). 결과 이벤트(140)의 끝에서는 다시 하지 않는다.
   */
  const [aceMatch, setAceMatch] = useState<PitcherAceMatch | null>(null)
  const beginAceMatch = useCallback(
    (command: MatchCommand, carry: StoryCarry) => {
      if (career === null || story === null) return
      const mission = aceMatchMissionOf(command.team, '투수')
      if (mission === null) return abortStoryAtMatch(carry)
      /*
       * SYS 8 투수편 갈래(0x8d7d0~0x8d834): g[0x175] = team − 1 · g[0x170]/g[0x172] = 결과 이벤트 · g[0x176] = 1 · g[0x177] = 0 ·
       * g[0xf6] = 모드 → 전역기록 저장(8d84a) · 지금 이벤트 본 표시(8d85c) · 커리어 저장(8d870). match 가 끝남을 돌려 114 끝
       * 0x1c014 가 떠나온 줄 본 표시(0x8b0e4) · 장소 끝 처리를 한다 — 대결을 나가도 이 칸들은 저장에 남는다.
       */
      const settled = story.context === '장소' ? settlePlaceForAceMatch(career, story.context) : career
      aceMatchPendingRef.current.hold(command.resultEvents)
      commit(markRewardedEvent(settled, null, carry.viewedEventIds))
      setStory(null)
      setAceMatch({ mission, resultEvents: command.resultEvents, carried: carry })
      setScene('마선수대결')
    },
    [abortStoryAtMatch, career, commit, story],
  )

  /**
   * 대결이 끝나 장면 0x106 으로 돌아왔다 — 미션 끝이 결과를 저장 +0x177 에 적고(0x4efc6~0x4f018, G 없음) 원래 모드로 돌린다.
   * 105 진입 곁가지(0x11b6c~0x11bbe)가 전역 +0x176 을 보고 **현재를 112 로** 두고 다음 = 140 → 진입 0x10df8 이 결과 바이트로
   * resultEvents[이김 ? 0 : 1] 을 0x8bdc9 로 부르고 `[다음 114, 뒤 105]` (0x10e40). 140 은 115·117 보다 앞이다.
   */
  const finishAceMatch = useCallback(
    (isWin: boolean) => {
      if (aceMatch === null) return
      setAceMatch(null)
      // 140 진입 0x10df8 — 대기 칸을 지우고 전역기록 저장(10f72)
      aceMatchPendingRef.current.clear()
      // 105 진입의 +0x176 갈래(0x11bb2)가 현재를 112 로 두고 0x118e4 — [!] 칸을 다시 찍는다(140 밑 지도가 이 값을 그린다)
      enterOutingMap()
      openStory({
        eventId: matchResultEventOf(aceMatch.resultEvents, isWin),
        context: '대결결과',
        viewed: [],
        carried: aceMatch.carried,
      })
    },
    [aceMatch, enterOutingMap, openStory],
  )

  const quitAceMatch = useCallback(() => {
    // 0x40140 — g[0x176] · g[0x177] · 결과 이벤트 칸을 안 건드리고 저장도 없다. 장면 0x106 은 헐리고 다음에 100 → 0x1c154 로 선다
    setAceMatch(null)
    quitGame()
  }, [quitGame])
  const dismissStoryNotice = useCallback(() => setStoryNotice(''), [])

  /** 128 이 끝났다 (팝업 7 · 8 닫힘 → 132 연말) — 접어 둔 연말 사슬을 이어 연말 0x10c54 의 이벤트로 */
  const finishPostseason = useCallback(
    (finished: PitcherCareer) => {
      setPostseasonPopup(null)
      continueYearEnd(finished, [...yearEndViewedRef.current, PITCHER_POSTSEASON_STEP_ID])
    },
    [continueYearEnd],
  )

  /**
   * 대진 128 [다음] — 키 0x13da0 (팝업이 떠 있으면 키가 안 먹는다, 0x1d06a 의 0x754f9).
   * 끝났으면 [137] 우승 팀 발표(팝업 7) · 지금 라운드에 내 팀이 있으면 142 경기 준비(→ 144 → 경기 장면)
   * · 아니면 CPU 끼리 내 차례/끝까지 돌리고 128 에 머문다.
   * 0xa4f60 의 −2(그대로)는 국가대항전(S+0x12c)일 때만이다 — 포스트시즌 경기도 시리즈 날짜 g 로 정규시즌처럼 맞바꾼다
   * (g == 0 이면 0x1b684 로 내가 0번 · 그 뒤 k = ((g−1)%6)/2+1 — 선발은 시리즈 짝수 날 등판).
   */
  const pressPostseason = useCallback(() => {
    if (career === null || career.postseason === null || scene !== '포스트시즌' || postseasonPopup !== null) return
    // 0x13da0 의 세 갈래 (`pressPostseasonBracket` 과 같은 차례) — CPU 끼리 경기(0xc2760)는 리그 표의 +0x2c 로 서고
    // 깎인 값을 남긴다(회복 없음). 그래서 CPU 갈래는 표를 잇는 `applyPitcherPostseasonProgress` 로 돌린다
    const series = career.postseason
    if (series.round === '종료') return setPostseasonPopup({ kind: '우승발표', champion: series.champion ?? -1 })
    // 내 차례 → 142 경기 준비 (0x13da0)
    if (isMyTurn(series, career.teamId)) return openMatchPrepare()
    commit(applyPitcherPostseasonProgress(career, random, aceLevels))
  }, [aceLevels, career, commit, openMatchPrepare, postseasonPopup, random, scene])

  /** 128 팝업 닫힘 — 틀 0x15984. 0xb 는 보상 뒤 128 에 머물고(해금 0x32 — 투수편), 7 → (내 팀 우승이면 8) → 132 */
  const closePostseasonPopup = useCallback(() => {
    if (career === null || scene !== '포스트시즌' || postseasonPopup === null) return
    if (postseasonPopup.kind === '정규시즌우승') {
      commit(applyRegularSeasonReward(career, REGULAR_SEASON_HIDDEN_ID.투수편, readRegularSeasonOtherModes?.()))
      return setPostseasonPopup(null)
    }
    if (postseasonPopup.kind === '우승발표') {
      const next = popupAfterChampion(career, postseasonPopup.champion)
      if (next !== null) return setPostseasonPopup(next)
      return finishPostseason(career)
    }
    finishPostseason(applyKoreanSeriesReward(career))
  }, [career, commit, finishPostseason, postseasonPopup, readRegularSeasonOtherModes, scene])

  const reset = useCallback(() => {
    // 모드 초기화 0x2c9c4 → 모드 저장 지우기 0x224ec(저장, 3) — +0x43 · +0x4f = 0 (0x225c4 · 0x225ca)
    nariGameSaveRef.current?.clear()
    setCareer(null)
    setGameOptions(null)
    setStory(null)
    setAceMatch(null)
    setScene('등록')
  }, [])

  /**
   * **칭호 팝업 하나** — 원본은 관리 화면(105) 갱신 0x1aec4 끝에서 판정 0x1a1c0 이 번호 순서로 **처음 맞는 하나만**
   * this+0x270 에 남겨 팝업 0x1274c 를 띄우고, 확인 0x1b1e4 가 비트·곧바로 장착(+0x1c4)·저장 뒤 다음 틀에 다시 판정한다
   * (P3 4절 — 장면 0x106 은 모드 3·4 공용). 105 에 있고 이벤트·알림이 없으면 판정한 값으로 둔다(타자편 `pendingTitle` 과 같다).
   * ⚠️ 근사: 웹 투수 관리 화면은 훈련 결과 창을 화면 안에서 띄워(원본은 125 → 105) 그 창과 칭호 팝업이 함께 설 수 있다.
   */
  const pendingTitle = career !== null && scene === '관리' && story === null && fileEvents !== null
    && storyNotice === '' && outingRecoveryNotice === ''
    ? nextPitcherTitleOf(career)
    : null

  return {
    career: shown,
    scene,
    nextGameFromManagement,
    matchAces,
    entryView: scene === '경기준비' ? entryView : null,
    gameOptions,
    shopTab,
    shopNotice,
    shopGpDetail,
    outingNotice,
    outingResult,
    outingRecoveryNotice,
    story,
    storyEvents,
    eventPlaceIds,
    storyReplacementsFor,
    storyNotice,
    pendingTitle,
    aceMatch,
    postseasonPopup,
    cup: cupView,
    cupMatch,
    actions: {
      confirmTitle,
      create,
      save: saveFromScreen,
      goto,
      quitGame,
      beginGame: () => beginGame(),
      // 곧장 경기 — 0x213c0(앱, 3, 0) 이 올린 투수편 저장으로 장면 0x104 의 셋업 0x39fdc 모드 3 갈래가 경기를 새로 세운다
      // (반 이닝 저장이 없어 처음부터 · 142 를 안 거쳐 굴림 없음 · 명부의 마선수 그대로). 경기 뒤 나리 장면이 새로 선다
      resumeInterruptedGame: (match: NariGameMatch | null) => {
        if (career === null) return
        matchPreparedRef.current = false
        if (match?.isNationalCup === true) {
          // 대회 경기 — 셋업 0x39fdc 모드 3 갈래가 올린 저장의 S+0x12c · 대회 칸(L+0xa8~)과 142 가 고쳐 둔 대표팀 칸 두 개로
          // 그 경기를 처음부터 다시 세운다(0x1f940 — 팀 10 → +0xbc4 · 그 밖 → +0xbe0). 142 를 안 거쳐 구장 굴림이 없다.
          // 대회가 없는 옛 웹 저장이면(대회를 저장하지 않던 때) 이어하기 자리(장면이 선 그대로)로 둔다
          const cup = career.nationalCup
          const matchup = cup === undefined ? null : nationalCupMatchupOf(cup)
          if (cup === undefined || matchup === null) return
          setMatchAces(null)
          setCupView(null)
          setCupMatch({ matchup, cup })
          cupGameRef.current = cup
          resetLiveGameState()
          setGameOptions(cupGameOptionsOf(career, matchup, cup, { gaugeSettingOn, throwModeManual }))
          return setScene('경기')
        }
        // 마선수는 저장의 나리 팀 레코드에 있다. 레코드가 없던 옛 저장이면 모드 저장 칸에 남겨 둔 그림자를 넣는다
        const loaded = career.nariTeams === undefined && match?.aces !== null && match?.aces !== undefined
          ? {
            ...career,
            nariTeams: seatNariMatchAces(nariTeamsOf(career), career.teamId, nextPitcherOpponentOf(career), match.aces),
          }
          : career
        if (loaded !== career) commit(loaded)
        setMatchAces(recordMatchAcesOf(nariTeamsOf(loaded), loaded.teamId, nextPitcherOpponentOf(loaded)))
        beginGame(loaded)
      },
      openNextGameStandings: () => {
        // 109 진입 0x10d8c — S+0x50 = 4 · 저장 (이어하기가 109 로 돌아온다)
        commitWith((current) => (current.seasonEndState === 109 ? current : { ...current, seasonEndState: 109 }))
        setNextGameFromManagement(true)
        setScene('다음경기순위')
      },
      confirmNextGameStandings: openMatchPrepare,
      // 142 확인 0x13cb6 → 144 → 경기. 굴린 마선수는 진입이 두 팀 명부에 넣었다(0xb88c8 · 0xb8870) — 경기에 그대로 실린다.
      // 저장 [모드+0x4c] = 1(전역기록 +0x4f "모드 3 경기 중간 저장됨")은 [14]·[최근게임] 의 0x327b8 모드 3 갈래가 읽는다 —
      // `+0x43 && +0x4f` 면 곧장 경기(`resumeInterruptedGame`). 89a6b81 의 "읽는 곳이 없다" 정정 — 타자편 `confirmMatchPrepare` 주석
      confirmMatchPrepare: () => {
        if (career === null || scene !== '경기준비') return
        // 0x13cca — +0x4f = 1 · 저장. 명부의 마선수는 커리어 저장의 나리 팀 레코드(`nariTeams`)가 들고 간다. 모드 저장 칸에는
        // 국가대항전 여부(S+0x12c)만 남긴다
        nariGameSaveRef.current?.start({ aces: null, isNationalCup: cupMatch !== null })
        if (cupMatch !== null) {
          // 국가대항전 — 대회 레코드 두 칸으로 선다(`cupGameOptionsOf`). 끝나면 이 대회로 하루를 넘긴다 (`finishCupGame`)
          cupGameRef.current = cupMatch.cup
          resetLiveGameState()
          setGameOptions(cupGameOptionsOf(career, cupMatch.matchup, cupMatch.cup, { gaugeSettingOn, throwModeManual }))
          return setScene('경기')
        }
        beginGame()
      },
      // 142 의 '4'/왼 · '6'/오른 → 143 경기 전 엔트리 보기(0x16af8, 보기 전용 — 타자편 `openEntryView` 와 같다).
      // 국가대항전이면 대회 레코드 두 칸(0x1f9a9 → 0x1f940 — S+0x12c)을 보인다
      openEntryView: (isMyTeam: boolean) => {
        if (career === null || scene !== '경기준비') return
        if (cupMatch !== null) {
          const options = cupGameOptionsOf(career, cupMatch.matchup, cupMatch.cup, { gaugeSettingOn, throwModeManual })
          return setEntryView(pitcherNariEntryViewOf(
            career, options, isMyTeam, pitcherCupTeamsOf(career, cupMatch.matchup.opponent),
          ))
        }
        setEntryView(pitcherNariEntryViewOf(career, recordGameOptionsOf(career), isMyTeam))
      },
      // 143 키 0x1457c — 끝 코드 1 · 2(상대 팀) · 3(내 팀)이면 142 로 (142 진입은 이전이 143 이라 다시 안 굴린다)
      pressEntryViewKey: (key: EntryKey) => {
        if (entryView === null) return
        const pressed = pressNariEntryKey(entryView, key)
        setEntryView(pressed.leaves ? null : pressed.view)
      },
      pointEntryViewCursor: (index: number) => {
        if (entryView !== null) setEntryView(pointNariEntryCursor(entryView, index))
      },
      cancelMatchPrepare: () => {
        if (career === null || scene !== '경기준비') return
        const target = nariMatchCancelTargetOf({ isNationalCup: cupMatch !== null, isPostseason: career.postseason !== null })
        if (target === '국가대항전' && cupMatch !== null) {
          // 0x13c72 −16 → S+0x12c 면 135 — 135 는 진입 함수가 없어 순위표가 그대로 다시 선다. 장면+0x288 은 그대로(다시 안 돌린다)
          setCupView({ cup: cupMatch.cup, atStandings: true })
          setCupMatch(null)
          return setScene('국가대항전')
        }
        if (target === '포스트시즌') {
          // 128 진입 0x120a4 를 다시 — S+0x50 = 0xf · 저장, 정규시즌 우승 보상을 아직 안 받았으면 팝업 0xb
          commitWith((current) => (current.seasonEndState === 128 ? current : { ...current, seasonEndState: 128 }))
          setPostseasonPopup(regularSeasonPopupOnEnter(career))
          return setScene('포스트시즌')
        }
        // 109 진입 0x10d8c — 이전 상태 142 라 취소가 안 먹고 저장도 건너뛴다(S+0x50 은 이미 4)
        commitWith((current) => (current.seasonEndState === 109 ? current : { ...current, seasonEndState: 109 }))
        setNextGameFromManagement(false)
        setScene('다음경기순위')
      },
      cancelNextGameStandings: () => {
        if (scene !== '다음경기순위' || !nextGameFromManagement) return
        // 105 진입 0x11910 이 S+0x50 = 3 · 저장(0x11990) — 웹 null
        commitWith((current) => (current.seasonEndState !== 109 ? current : { ...current, seasonEndState: null }))
        setScene('관리')
      },
      finishGame,
      confirmGameResult,
      /**
       * 135 [확인](0x10680) → **142 경기 준비** — 0x1c46c 가 내 팀을 대진 칸 0·1 중 대한민국(10)으로 끼운다. S+0x12c 라 마선수
       * 넣기(1c5fe)를 건너뛰고, 같은 문(장면+0x288) 안에서 대회 레코드를 오늘 준비로 고친다(`preparePitcherCupMatch` — 상대국 g ≠ 0
       * 이면 돌리기 · 대표팀은 모드 3 갈래). 이전 상태가 143 이 아니면 구장 0x78664(무대, 홈 팀) — 대회 팀은 10~13 이라
       * **rand(0, 10) 한 번**(취소로 135 에 갔다 다시 와도 또).
       */
      startCupGame: (matchup: NationalCupMatchup, cup: NationalCup) => {
        if (career === null) return
        // 142 진입 0x1c46c(0x1c47a) — +0x6b = 0
        resetLiveGameState()
        if (!matchPreparedRef.current) {
          commitWith((current) => ({
            ...current,
            nariCupTeams: preparePitcherCupMatch(pitcherCupTeamsOf(current, matchup.opponent), cup.day, current.role),
          }))
        }
        matchPreparedRef.current = true
        rollNariMatchStadium(random, nationalCupSideOf(cup, matchup.myTeam) === 1 ? matchup.myTeam : matchup.opponent)
        setEntryView(null)
        setMatchAces(null)
        setCupView(null)
        setCupMatch({ matchup, cup })
        setScene('경기준비')
      },
      /**
       * 대회 끝 — 결과 팝업 0x25 · 보상 팝업 0x26 을 닫았다 (0x1b92c). 우승이면 보상(인기 +20 · 평판 +30 · 2000만 · G +1000 —
       * 0x22c7d(g, 1000, 모드 3))을 얹고, S+0x12c = 0 · 0x1faa1(g, 1, 1) 로 내 투수 포인터를 원래 레코드로 · 새 시즌 0x1b768.
       * 열린 히든 팀(0x19f30)은 `openedHiddenIds` 에 넣는다 (타자편 `finishCup` 과 같다).
       */
      finishCup: (finish: NationalCupFinish) => {
        if (career === null) return
        const rewarded = applyPitcherEventRewards(career, careerNationalCupRewardItems(finish.reward), random)
        if (finish.reward.gamePoint > 0) {
          recordStat({ kind: 'G획득', mode: PITCHER_LEAGUE_MODE, amount: finish.reward.gamePoint })
        }
        const missing = finish.openedTeams.filter((id) => !rewarded.openedHiddenIds.includes(id))
        setCupView(null)
        startNewSeason({ ...rewarded, openedHiddenIds: [...rewarded.openedHiddenIds, ...missing] })
      },
      beginYearEnd,
      continueCareer,
      retire,
      continueAfterEnding,
      receiveEndingBonus,
      finishEnding,
      eraseSaveForHallOfFame,
      openShop,
      purchase,
      closeShopGpDetail,
      openOuting,
      runOutingFunction,
      enterOutingPlace,
      closeOutingResult,
      dismissOutingRecoveryNotice,
      giveStoryReward,
      confirmStoryChoice,
      completeStory,
      confirmEventSystemWindow,
      abortStoryAtMatch,
      beginAceMatch,
      finishAceMatch,
      quitAceMatch,
      dismissStoryNotice,
      pressPostseason,
      closePostseasonPopup,
      reset,
    },
  }
}
