import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ITEM_WINDOW_KIND } from '@/widgets/season/lib/seasonItemMenu'
import type { ItemWindowKind } from '@/widgets/season/lib/seasonItemMenu'
import {
  GameIncomeScreen, NextGameScreen, PlayerRecruitScreen,
  SeasonEndingScreen, SeasonInfoScreen, SeasonItemMenuScreen, SeasonManagementScreen, SeasonChainFrameScreen,
  SeasonOutingScreen, SeasonSummaryScreen, SeasonTeamMenuScreen,
  SeasonTrainingScreen, StadiumShopScreen, TradeScreen, CoachHireScreen,
  SeasonMatchInfoScreen, seasonMatchInfoLines, DayResultBoardScreen,
  SeasonPlayerPickScreen, SeasonPlayerCardScreen, seasonCardAbilitiesOf, seasonPlayerDetailViewOf, seasonCardInfoOf,
  SeasonTeamInfoScreen, seasonTeamInfoRowsOf, SeasonOwnedItemsScreen, SeasonRecordPickPopup, SeasonRecordRankScreen,
  SeasonEquipmentScreen, SeasonItemShopScreen, SeasonStaminaPickScreen, SeasonEventUnderlay, SeasonEventEndFrame,
  SeasonScreenFade,
} from '@/pages/season'
import { seasonPlayerEquipmentOf } from '@/entities/season-mode/model/seasonPlayerRecord'
import { SEASON_STAMINA_ITEM } from '@/entities/season-mode/model/seasonItemShop'
import { moveRankingPage, rankSeasonRecords, rankingCategoriesOf } from '@/entities/season-mode/model/seasonRecordRanking'
import type { SeasonRankingSide } from '@/entities/season-mode/model/seasonRecordRanking'
import { fillModeText } from '@/widgets/season/lib/seasonText'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { AceSelectScreen } from '@/pages/general-mode'
import { EntryEditorScreen } from '@/widgets/entry-editor'
import { TEAMS } from '@/shared/config/original/teams'
import {
  DEFAULT_OPENED_ACE_BATTER_IDS, DEFAULT_OPENED_ACE_PITCHER_IDS,
} from '@/pages/general-mode/lib/generalModeSetup'
import { MatchSettingsWindow } from '@/pages/match-settings'
import { SQUAD_PURPOSE } from '@/entities/season-mode/model/preGameFlow'
import { SeasonTeamSelectScreen } from '@/pages/season/ui/SeasonTeamSelectScreen'
import { MessageBox, RawScreen, ScreenOverlay } from '@/shared/ui'
import { SeasonOutingMap } from '@/pages/season/ui/SeasonOutingMap'
import { SeasonOutingPopup } from '@/pages/season/ui/SeasonOutingPopup'
import { StoryScreen } from '@/pages/story/ui/StoryScreen'
import { SEASON_PLAYABLE_EVENTS, YEAR_GOAL_EVENT_ID } from '@/entities/season-mode/model/seasonEventFlow'
import { useEventEndFrame } from '@/app/model/useEventEndFrame'
import { SEASON_YEAR_GOAL_LABEL_SET } from '@/pages/story/lib/yearGoalWindow'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'
import { judgeSeasonEnding } from '@/entities/season-mode/model/seasonRewards'
import type { PostseasonSeries } from '@/entities/league/model/league'
import { NationalCupScreen } from '@/pages/national-cup/ui/NationalCupScreen'
import { TeamGameScreen } from '@/pages/team-game/ui/TeamGameScreen'
import type { RandomPort } from '@/shared/api/random/randomPort'
import { seasonRewardNoticeContextOf } from '@/entities/story/model/rewardNotice'
import type { useGameSettings } from '@/app/model/useGameSettings'
import {
  seasonGoalInputOf, seasonGoalWindowNumbersFor, seasonLeagueRecordsOf,
} from '@/app/model/useSeasonSession'
import type { SeasonSession } from '@/app/model/useSeasonSession'
import { seasonStadiumOf } from '@/entities/season-mode/model/stadiumItems'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'
import {
  EMPTY_COLLECTION, HALL_OF_FAME_BATTER_FIRST_RECORD_ID, HALL_OF_FAME_MAX_BATTERS, HALL_OF_FAME_MAX_PITCHERS,
  HALL_OF_FAME_PITCHER_FIRST_RECORD_ID, hallOfFameEquipmentNibblesOf, hallOfFameRecordIdOf,
} from '@/entities/collection/model/collection'
import { HallOfFameScreen } from '@/pages/special/ui/SpecialScreen'
import type { HallOfFameNariPlayer } from '@/pages/special/ui/SpecialScreen'
import type { Collection, HallOfFameSide } from '@/entities/collection/model/collection'
import type { RecruitCandidate, RecruitListInput } from '@/pages/season'
import { nariRecruitPlayerOf } from '@/entities/season-mode/model/playerRecruit'
import {
  NARI_EQUIP_REFUSAL_TEXT_ID, PLAYER_PICK_PURPOSE, playerPickCancelTarget, refusesEquipment,
} from '@/entities/season-mode/model/playerPick'
import type { PlayerPickPurpose } from '@/entities/season-mode/model/playerPick'
import { seasonPlayerRecordOf } from '@/entities/season-mode/model/seasonPlayerRecord'
import { ENTRY_TAB } from '@/entities/season-mode/model/entryEditor'
import type { EntryTab } from '@/entities/season-mode/model/entryEditor'
import type { SeasonEntryBatterRecord, SeasonEntryPitcherRecord } from '@/entities/season-mode/model/seasonEntry'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'

interface SeasonRouteProps {
  readonly session: SeasonSession
  readonly random: RandomPort
  /** 경기 중 메뉴 "설정" 칸과 자동진행 G 검사에 쓴다 */
  readonly gameSettings: ReturnType<typeof useGameSettings>
  /**
   * 시즌모드에서 나간다 — 메인 메뉴로 (원본은 `0xbc290(앱, 0x103)`). `openTier` 5 는 전역 [0x140006c] = 5(게임시작 목록으로 바로 —
   * 관리 메뉴 0xc9 취소 0x8f5a). 없으면 처음 단
   */
  readonly onExit: (openTier?: 5) => void
  /**
   * 마선수 오픈 플래그(`mgr[0x30..0x39]`)·레벨(`mgr[0x13a..]`)과 오픈·레벨업 처리 — 경기 전 마선수 고르기
   * 0xd7 이 일반모드 상태 21 과 **같은 전역 칸**을 본다(0xa248 의 `저장[0x30 + 칸]`). 앱의 `aceSelect` 를
   * 그대로 넘기면 된다. 안 넘기면 새 저장 기본 개방분(싸이커·메디카)만 열려 있고 오픈·레벨업이 안 된다.
   */
  readonly aceSelect?: {
    readonly openedAcePitcherIds: readonly number[]
    readonly openedAceBatterIds: readonly number[]
    readonly levels: Readonly<Record<number, number>>
    readonly onOpenAce: (cell: number) => void
    readonly onLevelUp: (cell: number, cost: number) => void
  }
  /**
   * 기록연감의 명예의 전당 — 선수영입(0xe2 → 0xdf) 후보 칸 1~4(투수 +0x880)·6~(타자 +0x940). 안 넘기면 빈 칸이다.
   * 앱의 `collection.collection` 을 그대로 넘기면 된다.
   */
  readonly hallOfFame?: Collection
  /**
   * 장비 창 0xdc 의 적용 0x7d90 이 명예 선수(0xb6348)의 장비를 산 뒤 0x2328c 로 명전 기록에도 니블을 옮긴다.
   * 앱의 `collection.syncSeasonHallOfFameEquipment` 를 넘기면 된다. 안 넘기면 명전 기록은 그대로다.
   */
  readonly onHallOfFameEquipment?: (side: HallOfFameSide, recordId: number, nibbles: readonly number[]) => void
  /**
   * 영입 목록 나리 칸 0·5 (0x5eb8c 목록 종류 0 — 나리 투수편·타자편 저장이 있으면 상태 1, 없으면 2).
   * 안 넘기면 둘 다 없음(상태 2)으로 그린다.
   */
  readonly nari?: { readonly 투수: HallOfFameNariPlayer | null; readonly 타자: HallOfFameNariPlayer | null }
  /**
   * 나리 칸 0·5 를 고르면 영입할 기록 — `0x22168` · `0x220ec` 가 주는 나리 저장의 내 선수 기록(이름·0xb6414·레퍼토리·보직).
   * 앱이 `seasonNariPitcherRecordOf` · `seasonNariBatterRecordOf` 로 만든다. 없으면 그 칸은 영입 후보가 없다.
   */
  readonly nariRecords?: {
    readonly 투수: SeasonEntryPitcherRecord | null
    readonly 타자: SeasonEntryBatterRecord | null
  }
}

/**
 * 관리 메뉴 진입 0x5044~0x505e — 이 이전 상태([this+0x28])에서 오면 0x8a2d8 로 가운데 판을 오른쪽에서 미끄러뜨린다.
 * 원본 표는 1 · 0xd3 · 0xcb · 0xf5 · 0xf1 다섯이다. 새 시즌은 원본이 0xca → 0xc8 → 0xcc → **0xcb** → 0xc9 로 가
 * 이전이 0xcb 지만, 웹은 0xc8·0xcc·0xcb 를 상태로 두지 않고 0xca 에서 곧장 0xc9 로 온다 — 그래서 0xca 를 0xcb 자리로 넣는다
 * (0xca 에서 0xc9 로 오는 다른 길은 없다: 취소는 장면을 나간다).
 */
const CENTER_SLIDE_FROM: readonly number[] = [
  1, SEASON_SCENE_STATE.이벤트재생, SEASON_SCENE_STATE.진입분기, SEASON_SCENE_STATE.엔딩, SEASON_SCENE_STATE.경기뒤마무리,
  SEASON_SCENE_STATE.팀고르기,
]

/** 나리 칸 후보 — id 0xfe · +0xa 0x80/0xa0 · 기록 사본 (`nariRecruitPlayerOf`) */
function nariRecruitOf(
  record: SeasonEntryBatterRecord | SeasonEntryPitcherRecord | null | undefined,
  isPitcher: boolean,
): RecruitCandidate | null {
  return record === null || record === undefined ? null : { name: record.name, player: nariRecruitPlayerOf(record, isPitcher) }
}

/** 명예의 전당 등록 `0x1f654`(투수: `+0xa = 0` · `+0 = i + 0xb4`) · `0x1f680`(타자: `+0xa = 0x20` · `+0 = i + 0xc8`) */
const HALL_OF_FAME_PITCHER_KIND = 0x00
const HALL_OF_FAME_BATTER_KIND = 0x20

/**
 * 선수영입 후보 목록의 명예의 전당 칸 — `0x1f62c(저장, i)`·`0x1f640(저장, i)` 가 주는 0x30 바이트 사본을 시즌 선수로.
 *
 * 등록(0x1f654·0x1f680, 직접 떴다)이 사본의 `+0x0a`(종류·칸 바이트)와 `+0`(선수 번호 = 칸 + 0xb4 / 0xc8)을 덮어쓴 뒤
 * 전역 기록에 복사하므로 그 둘은 칸 번호로 정해진다 — 중복 검사 `0xb50ac` 가 이 번호를 견준다.
 * ⚠️ 나머지 칸(+0x1c 수비 위치·+0x2c 스태미나)은 기록연감에 남아 있지 않다 — 0 으로 둔다. 영입이 투수 스태미나를
 * 10000 으로, 타자 수비 위치를 밀려난 선수의 자리로 덮으므로(S6 4-2·4-3) 영입 결과에는 닿지 않는다.
 * 경기 출전은 시즌 세션이 명전 칸을 기록으로 싣는다(05ac4dd `seasonHallOfFameRecordSourceOf`).
 */
function hallOfFameRecruitsOf(hallOfFame: SeasonRouteProps['hallOfFame']): Pick<RecruitListInput, 'hallOfFamePitchers' | 'hallOfFameBatters'> {
  if (hallOfFame === undefined) return { hallOfFamePitchers: [], hallOfFameBatters: [] }
  const pitchers = Array.from({ length: HALL_OF_FAME_MAX_PITCHERS }, (_, slot): RecruitCandidate | null => {
    const famer = hallOfFame.hallOfFamePitchers.find((candidate) => candidate.slot === slot)
    return famer === undefined ? null : {
      name: famer.name,
      player: { id: hallOfFameRecordIdOf('투수', slot), kindByte: HALL_OF_FAME_PITCHER_KIND, fieldPosition: 0, stamina: 0 },
    }
  })
  const batters = Array.from({ length: HALL_OF_FAME_MAX_BATTERS }, (_, slot): RecruitCandidate | null => {
    // 옛 저장은 칸 번호가 없어 목록 순서가 칸이다 (`normalizeCollection` 과 같다)
    const famer = hallOfFame.hallOfFame.find((candidate, index) => (candidate.slot ?? index) === slot)
    return famer === undefined ? null : {
      name: famer.name,
      player: { id: hallOfFameRecordIdOf('타자', slot), kindByte: HALL_OF_FAME_BATTER_KIND, fieldPosition: 0, stamina: 0 },
    }
  })
  return { hallOfFamePitchers: pitchers, hallOfFameBatters: batters }
}

/**
 * 시즌 모드 라우팅 (원본 장면 0x105).
 *
 * 어느 화면 다음에 무엇이 오는지는 `entities/season-mode` 의 상태 기계가 정하고,
 * 여기서는 그 장면 번호에 맞는 화면을 고르기만 한다.
 *
 * **아직 화면이 없는 장면**(연초 목표 0xd4 등)은
 * 알림을 띄우고 관리 메뉴로 되돌린다 — 조용히 아무것도 안 하는 것보다 낫다.
 */
export function SeasonRoute({
  session, random, gameSettings, onExit, aceSelect, hallOfFame, nari, nariRecords, onHallOfFameEquipment,
}: SeasonRouteProps) {
  const { state, scene, league, roster, playerStats, series, cup, gameOptions, notice, actions } = session

  /** 아이템 메뉴에서 고른, 웹에 아직 없는 창 종류 (`[win+0x1a4]`) */
  const [missingWindow, setMissingWindow] = useState<ItemWindowKind | null>(null)
  /** 아이템 상점 0xdc 의 창 종류 1 서브아이템 · 2 GP (0x5f3c 가 0xd0 의 칸으로 고른다). null 이면 구장·장비 갈래 */
  const [shopKind, setShopKind] = useState<1 | 2 | null>(null)
  /** 0xe8 에서 돌아오면 GP 창 커서를 칸 3 으로 (0x5f3c 이전 상태 0xe8 갈래) */
  const [shopCursor, setShopCursor] = useState(0)
  /** 기록순위 창 0x80 — this+0x16c (1 타자기록 · 0 투수기록). 0x9008 칸 3 이 1 로 열고, null 이면 창이 없다 */
  const [recordPick, setRecordPick] = useState<SeasonRankingSide | null>(null)
  /** 0xdb 목록 — 창에서 고른 쪽과 ed+0x444(종류표의 쪽). 0x5761c 가 들어올 때마다 쪽 0 으로 만든다 */
  const [recordRank, setRecordRank] = useState<{ readonly side: SeasonRankingSide; readonly page: number }>({ side: '타자', page: 0 })
  /**
   * 훈련 결과 팝업 글 상자 첫 줄 [창+0x2d8] — 시즌 장면 창의 칸이라 팝업 · 0xcf 를 떠나도 남는다(시즌에서 비우는 곳이 없다,
   * `SeasonTrainingScreen` 주석). **창의 수명은 장면 0x105 와 같다** (직접 떴다):
   * - 창은 장면 0x105 초기화 0x3b14 의 0x3ef4~0x3f7c 가 `new(0x398)` → 0x7b7b9 로 만들어 [장면+0xc0] 에 넣는다.
   *   new 0x1239 → 0x2ac4 는 잡은 칸을 0 으로 채우고(0x2ad4 memset) 생성자 0x7b4dc 는 +0x2d8 을 안 건드려 **새 창은 0** 이다.
   * - 장면 전환 0x3874 는 [앱+0x20] 에 다음 장면이 서면 지금 장면을 소멸자(vt+4, 0x3948)로 지우고 다음 장면을 new 한다.
   *   그래서 0xe1 → 경기 장면 0x104 로 가면 0x105 와 창이 사라지고, 경기 뒤 0x105 로 돌아오면 새 창(첫 줄 0)이다.
   * 웹은 경기 화면이 이 라우트 안(`경기직전` 0xe1)에 있으므로 0xe1 에 들어설 때 0 으로 되돌린다. 메인 메뉴로 나가면 라우트가 내려가
   * 다시 서며 0 이다.
   */
  const [trainingResultFirstLine, setTrainingResultFirstLine] = useState(0)
  useEffect(() => {
    if (scene === SEASON_SCENE_STATE.경기직전) setTrainingResultFirstLine(0)
  }, [scene])
  /**
   * 외출 지도 고른 칸 this+0xf8 — 장면 0x105 객체 칸이라 지도를 오가도 남고(진입 0xbd24 는 그림만 싣는다), 경기로 장면이
   * 지워졌다 새로 서면(위 창 첫 줄과 같은 수명) 0 이다.
   */
  const [outingCursor, setOutingCursor] = useState(0)
  useEffect(() => {
    if (scene === SEASON_SCENE_STATE.경기직전) setOutingCursor(0)
  }, [scene])
  /** 0xdf 목적 1 에서 나리 선수를 고르면 뜨는 StrMODE[220] 알림 (0xbbef9(…, 1, 1, 1) — 상태는 0xdf 그대로) */
  const [pickNotice, setPickNotice] = useState<string | null>(null)
  /**
   * 공용 선수 고르기 0xdf 의 목적 `this+0x110` 과 목록 탭(ed+0x33f)·커서 — 목적 1·2 만 (3 선수영입은 `PlayerRecruitScreen` 이 든다).
   * 원본 목록 객체 [this+0xa8] 는 장면이 사는 동안 남지만 0xdf 에 들어올 때마다 다시 채워 커서는 0 이고, 탭만
   * 0xd9·0xdc 에서 돌아올 때 창+0x24c(타자)를 따른다 (0x5980).
   */
  const [playerPick, setPlayerPick] = useState<{
    readonly purpose: PlayerPickPurpose
    readonly tab: EntryTab
    readonly cursor: number
  } | null>(null)
  /**
   * 메인 메뉴에서 들어오는 길 = 0x327b8(this, 2) 의 모드 2 갈래 — `+0x42 && +0x4e` 면 장면 0x105 를 세우지 않고 곧장 경기
   * 장면 0x104 다(메인 메뉴 시즌모드 0x24698 · [최근게임] 모드 2 가 같은 길). 첫 그림 전에 갈라 관리 화면이 한 번도 서지 않게
   * 첫 렌더는 비워 둔다.
   */
  /**
   * 이전 장면 — 관리 메뉴 0xc9 진입 0x4efc 가 이전 상태 1 · 0xd3 · 0xcb · 0xf5 · 0xf1 이면 가운데 판을 미끄러뜨린다(0x8a2d8).
   * 처음 서는 관리 메뉴(이전 없음)는 진입 분기 0xcb 를 지난 것이다.
   */
  const sceneTrail = useRef<{ readonly scene: number; readonly previous: number | null }>({ scene, previous: null })
  if (sceneTrail.current.scene !== scene) sceneTrail.current = { scene, previous: sceneTrail.current.scene }
  const previousScene = sceneTrail.current.previous
  /** 0xd3 재생이 끝난 한 틀 — 대화창 없이 0xa09c 의 끝 그림을 그린 뒤 넘긴다 (`useEventEndFrame`) */
  const eventEnd = useEventEndFrame(actions.finishSeasonEvent)
  /** 엔딩을 넘긴 틀이 건 효과기 종류 2 — 관리 메뉴 0xc9 위에서 돈다 (`SeasonEndingScreen`) */
  const [isEndingFadeIn, setEndingFadeIn] = useState(false)
  const [isEnteringGame, setEnteringGame] = useState(() => session.isGameInProgress)
  /** 장면 0x105 를 세운 굴림은 들어올 때 한 번 (StrictMode 의 효과 다시 돌기에도) */
  const isSceneConstructed = useRef(false)
  useLayoutEffect(() => {
    // 3284e — 중간 저장 경기(+0x42 && +0x4e)가 없으면 장면 0x105 를 세운다: 상태 1 적재 0x75fc 의 팁 rand(0, 73) 이 그 장면 맨 앞
    if (!isEnteringGame) {
      if (!isSceneConstructed.current) actions.constructScene()
      isSceneConstructed.current = true
      return
    }
    actions.resumeSavedGame()
    setEnteringGame(false)
    // 들어올 때 한 번만 — 0x327b8 은 시즌모드에 들어오는 그 순간에만 돈다
  }, [])
  if (isEnteringGame) return null

  if (missingWindow !== null) {
    return (
      <RawScreen>
        <MessageBox
          text={`이 화면은 아직 없습니다 (장면 0xdc 창 종류 ${missingWindow})`}
          buttons={['OK']}
          onAnswer={() => setMissingWindow(null)}
        />
      </RawScreen>
    )
  }

  if (notice !== '') {
    return (
      <RawScreen>
        <MessageBox text={notice} buttons={['OK']} onAnswer={actions.clearNotice} />
      </RawScreen>
    )
  }

  // 저장이 없으면 팀 고르기부터다 (0xca, 키 0x8da4) → 이름 입력 0xc8 → [2] 예 → 새 시즌(0xcc).
  // 열린 히든 팀(전역 +0x70)은 그림만 서고 힌트 팝업을 띄운다.
  // 취소는 관리 메뉴 취소와 같이 [0x140006c] = 5 로 메인 메뉴에 나간다 (0x8ec8)
  if (state === null || scene === SEASON_SCENE_STATE.팀고르기) {
    return (
      <SeasonTeamSelectScreen openedHiddenIds={hallOfFame?.openedHiddenIds ?? []}
        onChoose={actions.chooseTeam} onExit={() => onExit(5)} />
    )
  }

  const backToManagement = () => actions.goto(SEASON_SCENE_STATE.관리메뉴)
  const backToTeamMenu = () => actions.goto(SEASON_SCENE_STATE.구단관리)
  // 목표 판정 0xa37bc 의 다섯 칸 — 팀정보 순위와 목표 창(SYS sub 1)이 같은 재료를 본다
  // 영입한 명전 선수의 기록(recordSource)도 세션 판정(392)과 같이 넘긴다 — 그 칸의 줄을 같은 열쇠로 센다
  const goalRecordOf = session.recordSource()
  const goalSource = {
    state, league, roster, playerStats, series, ...(goalRecordOf === undefined ? {} : { recordOf: goalRecordOf }),
  }
  const goalInput = seasonGoalInputOf(goalSource)
  // 시상 순위표의 재료 — 시상 화면에서만 만든다(명전 기록을 그때 읽는다)
  const leagueRecordSourceOf = () => {
    const recordOf = session.recordSource()
    return {
      league, myTeamId: state.record.teamId, roster, cpuRosterOf: session.cpuRosterOf, playerStats,
      ...(recordOf === undefined ? {} : { recordOf }),
    }
  }

  // 이벤트 재생 0xd3 (갱신 0x5110 · 키 0x90ec · 그리기 0xa09c → 대화창 0x8b5ac).
  // 대화창 0x8b5ac 가 공 무늬 · 상태판(둘째 인자 [이벤트+0xb]) · 머리띠를 먼저 깐다 (`SeasonEventUnderlay`).
  // 지도 갈래([gfx+0x174] 0x70 · 0x71)가 아니므로 초상화 바닥 y 는 135 다(0x7fdee — `StoryScreen` 기본).
  if (scene === SEASON_SCENE_STATE.이벤트재생 && session.eventPlayback !== null) {
    const playback = session.eventPlayback
    const event = SEASON_PLAYABLE_EVENTS.find((candidate) => candidate.id === playback.eventId)
    if (event !== undefined) {
      if (eventEnd.isEnding) {
        // 앞 상태 [this+0x28] — 0xd1 지도면 지도, 0xc9 면 관리 6칸, 그 밖은 칸 없음. 연초 목표(내장 이벤트)는 0xc9 → 0xd4 → 0xd3 이라
        // 앞 상태가 0xd4 다(웹은 0xd4 를 상태로 안 두고 관리 메뉴에서 곧장 튼다)
        const kind = previousScene === SEASON_SCENE_STATE.외출지도
          ? '지도'
          : previousScene === SEASON_SCENE_STATE.관리메뉴 && playback.eventId !== YEAR_GOAL_EVENT_ID ? '관리메뉴' : '칸없음'
        return (
          <RawScreen>
            <SeasonEventEndFrame record={state.record} teamMorale={state.teamMorale} gamePoint={session.gamePoints}
              kind={kind} cursor={session.menuCursors.management} />
          </RawScreen>
        )
      }
      return (
        <RawScreen>
          <SeasonEventUnderlay record={state.record} teamMorale={state.teamMorale} gamePoint={session.gamePoints} />
          <ScreenOverlay>
            <StoryScreen
              // 명령 5 의 500ms 진동(0x3a44)은 환경설정 진동(옵션 +0x3b)이 켜졌을 때만
              isVibrationOn={gameSettings.settings.isVibrationOn}
              // 0x8bab8 — 시즌모드(0x7b999)면 말하는 이 1 의 이름 머리말이 없다
              isSeasonMode
              key={playback.serial}
              events={SEASON_PLAYABLE_EVENTS}
              event={event}
              // 화자 1(플레이어)은 s_event 에 없다. fmt 9 의 %s 는 구단 이름(SR+0x17c)이다
              playerName={state.record.name}
              teamName={state.record.name}
              onComplete={eventEnd.end}
              // s_event 에는 경기(match) 명령이 없다
              onMatch={() => undefined}
              // SYS sub 1 올해의 목표 창 — 연초 0xd4 내장 이벤트 · 392 (0x8d304 → 0x86fdc, 0x8656c 모드 2 갈래)
              yearGoalWindowOf={() => ({ labelSet: SEASON_YEAR_GOAL_LABEL_SET, ...seasonGoalWindowNumbersFor(goalSource) })}
              // SYS sub 3 · 4 — 시상 370 · 371 의 타이틀 창 0x8b3bc · 376 의 MVP 창 0x8b23c (시즌 갈래)
              systemWindowTextOf={(command) => session.awardWindowTextOf(command.sub)}
              // 보상 명령 7 의 알림 창 — 0x8beb8 글(모드 2 갈래) → 0x74ef4 종류 1. 종류 11(490)은 글이 굴린다
              rewardNoticeContext={() => seasonRewardNoticeContextOf(state.record, random)}
              // system 창 답 0 → 0x7fe90 (기록 +0x187 = 1 · 저장)
              onSystemWindowConfirm={actions.confirmEventSystemWindow}
              // 보상 명령 7 은 창을 세운 그 갱신에 준다 (0x8c460 모드 2)
              onReward={actions.giveSeasonEventReward}
              // 선택지 OK → 0x8b0e4 (떠나온 줄 본 표시 · 저장)
              onChoiceConfirm={actions.confirmSeasonEventChoice}
            />
          </ScreenOverlay>
        </RawScreen>
      )
    }
  }

  if (scene === SEASON_SCENE_STATE.관리메뉴) {
    const request = session.tradeRequest
    return (
      <>
      <SeasonManagementScreen
        state={state}
        // 0xec10 — StrMODE[203] "[%s] 팀에서 트레이드 요청이 왔습니다 확인 하시겠습니까?", %s = 팀 이름([this+0x158])
        alert={session.isTradeRequestAlertOpen
          ? { text: fillModeText(ORIGINAL_MODE_TEXT[203] ?? '', TEAMS[request.opponentTeamId]?.name ?? ''),
            onAnswer: actions.answerTradeRequest }
          : null}
        // 메뉴 객체 this+0x70 의 커서 — 장면이 사는 동안 이어진다 (요청 "예" 는 칸 1 로 옮긴다)
        cursor={session.menuCursors.management}
        onCursorChange={(index) => actions.moveMenuCursor('management', index)}
        onSelect={(item, target) => {
          // 관리 메뉴 칸 5 → 0xd8 다음경기 (점프표 0xcbe40). 경기는 그 화면의 확인에서 시작한다
          if (item === '다음경기') return actions.openNextGame()
          actions.goto(target)
        }}
        // 관리 메뉴 키 0x8f30 의 취소(−16) 8f5a~8f6e: 0x375d · [0x140006c] = 5 · 장면 0x103 — 게임시작 목록으로 바로 연다
        onExit={() => onExit(5)}
        gamePoint={session.gamePoints}
        centerSlidesIn={previousScene === null || CENTER_SLIDE_FROM.includes(previousScene)}
      />
      {/* 엔딩을 넘긴 0x8bd8 8d1e~8d2c 의 효과기 종류 2(검정에서 밝아짐) — 0xc9 위에서 아홉 틀, 그동안 키가 안 먹는다 */}
      {isEndingFadeIn && <SeasonScreenFade kind="검게어두워짐" onEnd={() => setEndingFadeIn(false)} />}
      </>
    )
  }

  if (scene === SEASON_SCENE_STATE.구단관리) {
    return (
      <SeasonTeamMenuScreen
        state={state}
        // 메뉴 객체 this+0x78 의 커서 — 관리 메뉴에서 들어오면 0 (0x47d8), 하위 화면에서 돌아오면 남는다
        cursor={session.menuCursors.teamMenu}
        onCursorChange={(index) => actions.moveMenuCursor('teamMenu', index)}
        onSelect={(_item, target) => actions.goto(target)}
        onBack={backToManagement}
        gamePoint={session.gamePoints}
      />
    )
  }

  // 장비 창 0xdc 종류 3 (들어옴 0x5f3c 칸 0 · 키 0x957c · 적용 0x7d90) — 선수 고르기 0xdf 목적 1 의 확인으로만 온다
  if (scene === SEASON_SCENE_STATE.아이템상점 && playerPick !== null && playerPick.purpose === PLAYER_PICK_PURPOSE.장착아이템) {
    const pick = playerPick
    const isPitcher = pick.tab === ENTRY_TAB.투수
    const player = (isPitcher ? session.tradeRoster.pitchers : session.tradeRoster.batters)[pick.cursor]
    if (player !== undefined) {
      const recordOf = session.recordSource()
      const view = seasonPlayerRecordOf(state.record.teamId, player, isPitcher, pick.cursor, recordOf)
      // 해금표 app+0xc0 — 기록연감의 전역 해금 목록과 이 세션이 연 칸
      const opened = [...(hallOfFame?.openedHiddenIds ?? []), ...session.openedHiddenIds]
      // 명예 선수(0xb6348) — 영입 0xc554 가 옮긴 명전 기록의 니블이 처음 값이다(웹 명단엔 사본이 없어 지금 명전 칸을 읽는다)
      const side: HallOfFameSide = isPitcher ? '투수' : '타자'
      // 0xb6348: 타자면 id − 0xc8 ≤ 8, 투수면 id − 0xb4 ≤ 0x18 (나리 0xfe 는 둘 다 아니다)
      const isHallOfFamer = player.id >= HALL_OF_FAME_PITCHER_FIRST_RECORD_ID && player.id <= HALL_OF_FAME_BATTER_FIRST_RECORD_ID + HALL_OF_FAME_MAX_BATTERS
      const equipment = player.equipment === undefined && isHallOfFamer && hallOfFame !== undefined
        ? hallOfFameEquipmentNibblesOf(hallOfFame, side, player.id) ?? seasonPlayerEquipmentOf(player, state.record.teamId, isPitcher)
        : seasonPlayerEquipmentOf(player, state.record.teamId, isPitcher)
      return (
        <SeasonEquipmentScreen
          record={state.record}
          playerName={view.name}
          isBatter={!isPitcher}
          equipment={equipment}
          abilities={seasonCardAbilitiesOf(view, { record: state.record, teamMorale: state.teamMorale })}
          isHiddenOpen={(id) => opened.includes(id)}
          gamePoint={session.gamePoints}
          onPurchase={(bought) => {
            actions.equipSeasonPlayer({ isPitcher, recordIndex: pick.cursor, money: bought.money, equipment: bought.equipment })
            // 0x7ef4~0x7f12 — 명예 선수면 0x2328c(저장, 줄, ed+0x33f) 로 명전 기록에도
            if (isHallOfFamer) onHallOfFameEquipment?.(side, player.id, bought.equipment)
          }}
          onBack={() => {
            // 0x5980 — 목록을 다시 채워 커서 0, 탭은 창+0x24c(이 선수가 타자였는가)대로
            setPlayerPick({ ...pick, cursor: 0 })
            actions.goto(SEASON_SCENE_STATE.선수고르기)
          }}
        />
      )
    }
  }

  // 아이템 상점 0xdc 종류 1·2 (키 0x957c · 적용 0x7d90) — 취소는 아이템 메뉴 0xd0 (0x9be8)
  if (scene === SEASON_SCENE_STATE.아이템상점 && shopKind !== null) {
    return (
      <SeasonItemShopScreen
        key={`${shopKind}-${shopCursor}`}
        kind={shopKind}
        record={state.record}
        teamMorale={state.teamMorale}
        gamePoint={session.gamePoints}
        initialCursor={shopCursor}
        onBuySubItem={actions.buySeasonSubItem}
        onBuyGpItem={(slot) => {
          const text = actions.buySeasonGpItem(slot)
          // 칸 3 십전대보탕 — 0x7d90 0x8012: 상태 0xe8 로
          if (text === null) actions.goto(SEASON_SCENE_STATE.스태미나회복)
          return text
        }}
        onBack={() => {
          setShopKind(null)
          actions.goto(SEASON_SCENE_STATE.아이템)
        }}
      />
    )
  }

  // 십전대보탕 투수 고르기 0xe8 (들어옴 0x5870 · 키 0x7c00) — 취소·회복 뒤 0xdc(GP 창 커서 3)
  if (scene === SEASON_SCENE_STATE.스태미나회복) {
    const recordOf = session.recordSource()
    const pitchers = session.tradeRoster.pitchers.map((player, index) => ({
      name: seasonPlayerRecordOf(state.record.teamId, player, true, index, recordOf).name,
      stamina: player.stamina,
    }))
    return (
      <SeasonStaminaPickScreen
        pitchers={pitchers}
        onPick={actions.recoverSeasonPitcherStamina}
        onBack={() => {
          setShopKind(ITEM_WINDOW_KIND.GP아이템)
          setShopCursor(SEASON_STAMINA_ITEM)
          actions.goto(SEASON_SCENE_STATE.아이템상점)
        }}
      />
    )
  }

  if (scene === SEASON_SCENE_STATE.구장관리 || scene === SEASON_SCENE_STATE.아이템상점) {
    return (
      <StadiumShopScreen
        record={state.record}
        mode={scene === SEASON_SCENE_STATE.구장관리 ? '구장관리' : '상점'}
        // 히든 칸 해금 플래그 `app[0xe0 + 종류×4 + (칸−4)]` (S3 7절) — 전역 저장 칸이라
        // 시즌 레코드가 아니라 세션이 들고 있다. 안 넘기면 히든이 영영 안 열린다
        isHiddenOpen={(unlockId) => session.openedStadiumIds.includes(unlockId)}
        onUnlock={actions.openStadiumItems}
        onChange={actions.updateRecord}
        // 상점(0xdc 종류 4) 취소는 아이템 메뉴 0xd0 (0x957c 종류 4 갈래 0x9aa2 → 0x9bd4~0x9bec)
        onBack={scene === SEASON_SCENE_STATE.구장관리 ? backToTeamMenu : () => actions.goto(SEASON_SCENE_STATE.아이템)}
      />
    )
  }

  // 트레이드 한 바퀴 (0xe4 팀 고르기 → 0xe5 영입 선수 → 0xe6 보상 선수 → 0xe7 확인·진행).
  // 원본도 한 장면 객체가 네 칸을 이어 들고 있어(this+0x154·0x158·0x15c) 화면 하나가 단계를 든다
  // CPU 트레이드 요청을 받으면 관리 메뉴에서 곧장 0xe5(영입 선수)로 온다 — 같은 화면이 요청 칸으로 단계를 든다
  if (scene === SEASON_SCENE_STATE.트레이드 || scene === SEASON_SCENE_STATE.트레이드영입선수) {
    return (
      <TradeScreen
        state={state}
        // 두 팀 레코드를 칸 차례로 — 투수는 로테이션(0xb5ca8)으로 섞인 레코드 차례다. 지난 트레이드로 바뀐 CPU 팀은
        // 시즌 저장의 명단 (0x1f9a9). 화면이 낸 칸은 세션(finishTrade)이 명단 첨자로 되돌린다
        roster={session.tradeRoster}
        opponentRosterOf={session.tradeRosterOf}
        gamePoints={session.gamePoints}
        random={random}
        request={scene === SEASON_SCENE_STATE.트레이드영입선수 ? session.tradeRequest : null}
        onTrade={actions.finishTrade}
        onFinish={actions.closeTradeResult}
        onCancelRequest={actions.cancelTradeRequest}
        onBack={backToTeamMenu}
        // 0xe4 히든 칸 힌트 — 해금(전역 +0x70)이면 [0] 줄이 빠진다 (0x82f0)
        openedHiddenIds={hallOfFame?.openedHiddenIds ?? []}
      />
    )
  }

  // 선수단 0xd7, this+0x11c = 1 — **경기 전 마선수 고르기**. 그림 0xaa24 가 공용 목록 k 2 + 0x5f395 +
  // 머리띠(4 "마선수선택", 바닥 0x205)로 일반모드 상태 21 과 같은 화면이라 그 화면을 그대로 쓴다
  if (scene === SEASON_SCENE_STATE.선수단 && session.squadPurpose === SQUAD_PURPOSE.경기전) {
    return (
      <AceSelectScreen
        phase={session.preGameAces.phase}
        openedAcePitcherIds={aceSelect?.openedAcePitcherIds ?? DEFAULT_OPENED_ACE_PITCHER_IDS}
        openedAceBatterIds={aceSelect?.openedAceBatterIds ?? DEFAULT_OPENED_ACE_BATTER_IDS}
        {...(aceSelect === undefined ? {} : {
          levels: aceSelect.levels, onOpenAce: aceSelect.onOpenAce, onLevelUp: aceSelect.onLevelUp,
        })}
        gamePoint={session.gamePoints}
        onSelect={actions.choosePreGameAce}
        onCancel={actions.cancelPreGameAce}
        // 공통 앞그림 0xb810 — 0xd7 는 0xdd · 0xe0 · 0xe1 밖이라 공 무늬를 먼저 깐다(일반모드 상태 21 은 장면이 달라 안 넘긴다)
        underlay={<SkinBackdrop kind="공무늬" />}
      />
    )
  }

  // 경기 직전 경기정보 0xdd — 목록 k 4 + 경기진행 설정 창 0x6042c (그림 0xb398)
  if (scene === SEASON_SCENE_STATE.경기정보 && session.pendingGame !== null) {
    const { options, kind } = session.pendingGame
    const isCup = kind === '국가대항전'
    return (
      <>
        <SeasonMatchInfoScreen
          lines={seasonMatchInfoLines({
            league, series, cup, inPostseason: state.record.inPostseason,
            myTeamId: options.ourTeamId,
            opponentTeamId: options.opponentTeamId,
            dayCounter: options.dayCounter ?? 0,
            ...(options.opponentDayCounter === undefined ? {} : { opponentDayCounter: options.opponentDayCounter }),
            ...(options.opponentPitcherOrder === undefined ? {} : { opponentPitcherOrder: options.opponentPitcherOrder }),
            acePitcherId: isCup ? -1 : session.preGameAces.pitcher,
            aceBatterId: isCup ? -1 : session.preGameAces.batter,
            opponentAces: options.opponentAces ?? null,
            myStarterName: session.matchInfoStarterName,
            opponentStarterName: session.matchInfoOpponentStarterName,
          })}
          myTeamId={options.ourTeamId}
          opponentTeamId={options.opponentTeamId}
          playerSide={options.playerSide}
          gamePoint={session.gamePoints}
          onStart={() => {
            // 설정 창이 열려 있으면 키가 모두 창으로 간다 (0x83f2 메뉴+0x2ba)
            if (!session.isMatchSettingsOpen) actions.startPendingGame()
          }}
          onOpenSettings={() => {
            if (!session.isMatchSettingsOpen) actions.toggleMatchSettings()
          }}
          onCancel={() => {
            if (!session.isMatchSettingsOpen) actions.cancelMatchInfo()
          }}
          onOpenEntry={(isUserTeam) => {
            if (!session.isMatchSettingsOpen) actions.openEntryEdit(isUserTeam)
          }}
        />
        {session.isMatchSettingsOpen && (
          <MatchSettingsWindow
            settings={session.matchSettings}
            onConfirm={actions.applyMatchSettings}
            onClose={actions.toggleMatchSettings}
          />
        )}
      </>
    )
  }

  // 엔트리 편집 0xe0 — 엔트리 목록 창 0x5cfec + 머리띠 (그림 0xb074), 키 0x7044 → 편집기 0x55864
  if (scene === SEASON_SCENE_STATE.엔트리편집 && session.entryEdit !== null) {
    const { entryEdit } = session
    return (
      <EntryEditorScreen
        editor={entryEdit.editor}
        lists={entryEdit.lists}
        teamName={`${TEAMS[entryEdit.teamId]?.name ?? ''} ${entryEdit.isUserTeam ? '(PLAYER)' : '(COM)'}`}
        isAceLocked={entryEdit.isAceLocked}
        gamePoint={session.gamePoints}
        onKey={actions.pressEntryKey}
        onMoveCursor={actions.pointEntryCursor}
        onCloseAceLocked={actions.closeEntryAceLocked}
      />
    )
  }

  // 코치채용 — 선수단 화면 0xd7 을 `this+0x11c = 2` 로 띄운 것 (P4 1b, 구단관리 칸 3)
  if (scene === SEASON_SCENE_STATE.선수단) {
    return (
      <CoachHireScreen
        state={state}
        gamePoints={session.gamePoints}
        // 오픈 검사 0xa734 — 경기 전 마선수 고르기와 같은 전역 칸(+0x30 + 칸)과 [43] G 오픈
        openedAcePitcherIds={aceSelect?.openedAcePitcherIds ?? DEFAULT_OPENED_ACE_PITCHER_IDS}
        openedAceBatterIds={aceSelect?.openedAceBatterIds ?? DEFAULT_OPENED_ACE_BATTER_IDS}
        {...(aceSelect === undefined ? {} : { levels: aceSelect.levels, onOpenAce: aceSelect.onOpenAce })}
        onHire={actions.updateRecord}
        onBack={backToTeamMenu}
      />
    )
  }

  // 공용 선수 고르기 0xdf — 목적 1(장착아이템)·2(선수정보). 목록은 내 팀 레코드 차례(투수는 로테이션으로 섞인 차례)
  if (scene === SEASON_SCENE_STATE.선수고르기 && playerPick !== null && playerPick.purpose !== PLAYER_PICK_PURPOSE.선수영입) {
    const pick = playerPick
    return (
      <SeasonPlayerPickScreen
        teamId={state.record.teamId}
        roster={session.tradeRoster}
        initialTab={pick.tab}
        gamePoint={session.gamePoints}
        overlay={pickNotice === null ? undefined : (
          <MessageBox text={pickNotice} buttons={['OK']} onAnswer={() => setPickNotice(null)} />
        )}
        onPick={(tab, index) => {
          setPlayerPick({ ...pick, tab, cursor: index })
          // 0xc3e8 확인 — 목적 2 → 카드 0xd9
          if (pick.purpose === PLAYER_PICK_PURPOSE.선수정보) return actions.goto(SEASON_SCENE_STATE.선수상세)
          // 목적 1 — 0xb5694(팀, ed+0x33f ? 0 : 1, 커서) 가 나리 선수(0xb6388)면 StrMODE[220], 아니면 장비 창 0xdc(종류 3).
          // 장비 창에서 부위 목록 취소 → 0xdf (0x97bc~0x97d6)
          const player = (tab === ENTRY_TAB.투수 ? session.tradeRoster.pitchers : session.tradeRoster.batters)[index]
          if (player === undefined) return undefined
          if (refusesEquipment(player)) return setPickNotice(ORIGINAL_MODE_TEXT[NARI_EQUIP_REFUSAL_TEXT_ID] ?? '')
          return actions.goto(SEASON_SCENE_STATE.아이템상점)
        }}
        onBack={() => {
          setPlayerPick(null)
          actions.goto(playerPickCancelTarget(pick.purpose))
        }}
      />
    )
  }

  // 선수 카드 0xd9 ↔ 능력치 상세 창 0xda — 0xdf 목적 2 에서 고른 선수 (0x5404: 0xb5694(팀, 탭 == 0 ? 1 : 0, 커서))
  if ((scene === SEASON_SCENE_STATE.선수상세 || scene === SEASON_SCENE_STATE.능력치상세) && playerPick !== null) {
    const pick = playerPick
    const isPitcher = pick.tab === ENTRY_TAB.투수
    const players = isPitcher ? session.tradeRoster.pitchers : session.tradeRoster.batters
    const player = players[pick.cursor]
    if (player !== undefined) {
      const recordOf = session.recordSource()
      const view = seasonPlayerRecordOf(state.record.teamId, player, isPitcher, pick.cursor, recordOf)
      const context = { record: state.record, teamMorale: state.teamMorale }
      return (
        <SeasonPlayerCardScreen
          teamId={state.record.teamId}
          view={view}
          abilities={seasonCardAbilitiesOf(view, context)}
          info={seasonCardInfoOf(view, TEAMS[state.record.teamId]?.name ?? '', player.kindByte)}
          detail={seasonPlayerDetailViewOf(view, context)}
          isDetailOpen={scene === SEASON_SCENE_STATE.능력치상세}
          gamePoint={session.gamePoints}
          onOpenDetail={() => actions.goto(SEASON_SCENE_STATE.능력치상세)}
          onCloseDetail={() => actions.goto(SEASON_SCENE_STATE.선수상세)}
          onBack={() => {
            // 0x48a0 취소 → 0xdf. 0x5980 이 목록을 다시 채워 커서 0 · 탭은 창+0x24c(이 선수가 타자였는가)대로
            setPlayerPick({ ...pick, cursor: 0 })
            actions.goto(SEASON_SCENE_STATE.선수고르기)
          }}
        />
      )
    }
  }

  if (scene === SEASON_SCENE_STATE.선수영입 || scene === SEASON_SCENE_STATE.선수고르기) {
    const recruits = hallOfFameRecruitsOf(hallOfFame)
    const careerPitcher = nariRecruitOf(nariRecords?.투수, true)
    const careerBatter = nariRecruitOf(nariRecords?.타자, false)
    return (
      <PlayerRecruitScreen
        teamId={state.record.teamId}
        roster={roster}
        // 자리 고르기 0xdf 목적 3 은 내 팀 레코드 차례(투수는 로테이션으로 섞인 차례) — 고른 칸 k 를 명단 첨자로
        pitcherRecordOrder={session.pitcherRecordOrder}
        gamePoint={session.gamePoints}
        // 영입 후보는 나만의리그 선수·명예의 전당에서 온다. 명예의 전당은 기록연감 칸(c3e66c1)에서 싣는다.
        // 나리 두 칸(0x22168·0x220ec — 투수편·타자편 저장의 내 선수)은 그 기록을 id 0xfe 선수로 통째 옮긴다
        list={{ careerPitcher: careerPitcher, careerBatter: careerBatter, ...recruits }}
        // 진입 0xe1dc: 목록 객체 [this+0xa8] 를 종류 0(+0x1fc = 0 · +0x80 = 0)으로 0x5eb8c 에 채우고 키 0xe340 이
        // 0x62569(목록, 키, 0) — 미션 선수 고르기(하위 17)와 같은 명예의 전당 목록이다. 빈 칸 StrCOMMON[38]/[39] ·
        // 잠긴 칸 [45]/[54](🌐) 는 목록이 띄운다.
        // 그리기 0xa10c: 공용 목록 0x63b15(…, 6, 1, [this+0x2c], −1) — 미션 선수 고르기(하위 17, 0x2dec8)와 같은 k 6 —
        // 뒤에 머리띠 0x7f4ec. 머리띠는 공통 앞그림 0xb810 이 0xe2 에서 기본 갈래 0x7f53c(hdr, 10, 5, 0) 로 세운 "시즌모드"
        // (+ G포인트 · 되돌아가기)라 미션(제목 11)·스페셜과 다르다.
        // 바탕은 공통 앞그림 0xb810 의 공 무늬 0x5fd61 이다(미션 하위 17 은 메뉴 바탕 0x58371) — backdrop="공무늬".
        // ⚠️ 미해결: 상태 0xe2 덧그림 0x669c0 → 0x65e80(목록 +0x298 객체를 54×75 버퍼에 그린다 — 캐릭터 그림으로 보임)은
        //    내부를 안 읽어 명예의 전당 화면 그대로 둔다.
        renderCandidates={({ choose, back }) => (
          <HallOfFameScreen
            frame={{ title: '시즌모드', gamePoint: session.gamePoints }}
            backdrop="공무늬"
            // 목록 애니 칸은 목록 주인별 모듈 값 — 시즌 선수영입 목록 (f5aee7b)
            listOwner="시즌"
            collection={hallOfFame ?? EMPTY_COLLECTION}
            mode={{
              kind: '선수고르기',
              nari: nari ?? { 투수: null, 타자: null },
              onPick: (pick) => {
                const isPitcher = pick.side === '투수'
                if (pick.hallOfFameIndex === null) {
                  return choose({ source: '나리', isPitcher, candidate: isPitcher ? careerPitcher : careerBatter })
                }
                const list = isPitcher ? recruits.hallOfFamePitchers : recruits.hallOfFameBatters
                return choose({ source: '명예', isPitcher, candidate: list[pick.hallOfFameIndex] ?? null })
              },
              onCancel: back,
            }}
            onBack={back}
          />
        )}
        onRecruit={(result) => {
          // 원본은 밀려난 선수를 빼지 않고 **끼워넣는다** — 그 규칙은 recruitPlayer 안에 있다
          actions.updateRoster(result.roster)
        }}
        // [180] 팝업(0x19)을 닫으면 0xce — 0x6fe0 (예전에는 영입하자마자 나가 팝업이 안 보였다)
        onDone={backToTeamMenu}
        onBack={backToTeamMenu}
      />
    )
  }

  if (scene === SEASON_SCENE_STATE.트레이닝) {
    return (
      <SeasonTrainingScreen
        state={state}
        // G 포인트는 전역 저장(+0x64) 칸이라 시즌 레코드에 없다 — 그 칸이 곧 지갑이다
        gamePoints={session.gamePoints}
        onTrain={(_slot, index) => actions.runTraining(index)}
        onBack={backToManagement}
        result={session.trainingResult}
        onCloseResult={actions.closeTrainingResult}
        resultFirstLine={trainingResultFirstLine}
        onResultFirstLineChange={setTrainingResultFirstLine}
      />
    )
  }

  if (scene === SEASON_SCENE_STATE.외출지도) {
    return (
      <SeasonOutingScreen
        state={state}
        cursor={outingCursor}
        onCursorChange={setOutingCursor}
        // 0x4a94 — 확인 팝업 0x16 에 "예": 장소를 넘기고 연출 0xe3 으로
        onRun={(_place, index) => actions.enterOuting(index)}
        onBack={backToManagement}
      />
    )
  }

  // 외출 연출 0xe3 (진입 0x5184 · 키 0x4944 · 갱신 0xce0c · 그리기 0xa06c = 지도 0x7ea64(gfx, p, 0) → 가운데 정렬판 0x84ea0).
  // 연출이 끝난 틀에 결과 0xc81c 가 굴리고 팝업 0x17 을 띄운다 — 팝업은 연출이 놓인 판 위에 뜨고, 닫으면 0xc9
  if (scene === SEASON_SCENE_STATE.외출연출 && session.outingPlace !== null) {
    const place = session.outingPlace
    const resultText = session.outingResultText
    return (
      <RawScreen>
        <SeasonOutingMap selected={place} hour={new Date().getHours()} />
        <SeasonOutingPopup place={place} onFinished={() => actions.runOuting(place)} />
        {resultText !== null && (
          <MessageBox text={resultText} buttons={['확인']} onAnswer={actions.closeOutingResult} />
        )}
      </RawScreen>
    )
  }

  if (scene === SEASON_SCENE_STATE.아이템) {
    return (
      <SeasonItemMenuScreen
        state={state}
        cursor={session.menuCursors.itemMenu}
        onCursorChange={(index) => actions.moveMenuCursor('itemMenu', index)}
        // 0xdc 는 칸마다 다른 창(0x5f3c)을 연다 — 칸 1 구장(종류 4) · 2 서브아이템(1) · 3 GP(2).
        // 칸 0 장착아이템은 먼저 선수 고르기 0xdf(this+0x110 = 1, 키 0x4da4)다
        onSelect={(_item, target, windowKind) => {
          if (target === SEASON_SCENE_STATE.선수고르기) {
            // 이전 상태가 0xd0 이라 탭은 1(투수) · 커서 0 (0x5980)
            setPlayerPick({ purpose: PLAYER_PICK_PURPOSE.장착아이템, tab: ENTRY_TAB.투수, cursor: 0 })
            return actions.goto(target)
          }
          // 구장·서브·GP 창은 선수 고르기를 안 거친다 — 장비 창 갈래(0xdf 목적 1)로 잘못 들어가지 않게 지운다
          setPlayerPick(null)
          if (windowKind === ITEM_WINDOW_KIND.서브아이템 || windowKind === ITEM_WINDOW_KIND.GP아이템) {
            setShopKind(windowKind)
            setShopCursor(0)
            return actions.goto(target)
          }
          setShopKind(null)
          return windowKind === ITEM_WINDOW_KIND.구장아이템 ? actions.goto(target) : setMissingWindow(windowKind)
        }}
        onBack={backToManagement}
        gamePoint={session.gamePoints}
      />
    )
  }

  // 구단정보 0xd5 (들어옴 0x5324 · 키 0x4884 취소 → 0xcd · 그림 0xae68)
  if (scene === SEASON_SCENE_STATE.구단정보) {
    const teamAbilities = state.teamAbilities[state.record.teamId] ?? []
    return (
      <SeasonTeamInfoScreen
        teamId={state.record.teamId}
        teamAbilities={teamAbilities}
        // 순위 0xb7aa1(SR+0x80, 내 팀, 0) — 목표 ① 과 같은 함수·같은 인자
        rows={seasonTeamInfoRowsOf({ record: state.record, teamAbilities, rank: goalInput.rank })}
        gamePoint={session.gamePoints}
        onBack={() => actions.goto(SEASON_SCENE_STATE.시즌정보)}
      />
    )
  }

  // 시즌정보 칸 1 아이템 0xd6 (들어옴 0x5ee4 창 종류 5 · 키 0x5f10 취소 → 0xcd · 그림 0xb1b4)
  if (scene === SEASON_SCENE_STATE.보유아이템) {
    return (
      <SeasonOwnedItemsScreen
        record={state.record}
        teamMorale={state.teamMorale}
        gamePoint={session.gamePoints}
        onBack={() => actions.goto(SEASON_SCENE_STATE.시즌정보)}
      />
    )
  }

  // 기록순위 0xdb (들어옴 0x56fc → 0x5761c · 키 0x74c4 → 0x5787c · 그림 0xafa8 → 0x5796c)
  if (scene === SEASON_SCENE_STATE.기록순위) {
    const category = rankingCategoriesOf(recordRank.side)[recordRank.page] ?? rankingCategoriesOf(recordRank.side)[0]
    // 순위 객체 0x9d789(…, 종류, 모드 2, 큰쪽 1, 고정문턱 0) — 열 팀 레코드를 훑는다. 규정 문턱은 SR+0xb2 경기 수
    const entries = rankSeasonRecords(
      seasonLeagueRecordsOf(leagueRecordSourceOf(), recordRank.side === '투수'), category.kind, state.record.games,
    )
    return (
      <SeasonRecordRankScreen
        side={recordRank.side}
        page={recordRank.page}
        entries={entries}
        myTeamId={state.record.teamId}
        gamePoint={session.gamePoints}
        onMovePage={(step) => setRecordRank((held) => ({ ...held, page: moveRankingPage(held.side, held.page, step) }))}
        onBack={() => actions.goto(SEASON_SCENE_STATE.시즌정보)}
      />
    )
  }

  // 시즌정보 0xcd — 네 칸 하위 메뉴 (키 0x9008)
  if (scene === SEASON_SCENE_STATE.시즌정보) {
    return (
      <SeasonInfoScreen
        state={state}
        gamePoint={session.gamePoints}
        isKeyEnabled={recordPick === null}
        overlay={recordPick === null ? undefined : (
          <SeasonRecordPickPopup
            side={recordPick}
            onToggle={() => setRecordPick((held) => (held === '타자' ? '투수' : '타자'))}
            onConfirm={() => {
              setRecordRank({ side: recordPick, page: 0 })
              setRecordPick(null)
              actions.goto(SEASON_SCENE_STATE.기록순위)
            }}
            onCancel={() => setRecordPick(null)}
          />
        )}
        // 메뉴 객체 this+0x74 의 커서 — 관리 메뉴에서 들어오면 0 (0x4d58), 하위 화면에서 돌아오면 남는다
        cursor={session.menuCursors.seasonInfo}
        onCursorChange={(index) => actions.moveMenuCursor('seasonInfo', index)}
        onSelect={(entry) => {
          const { action } = entry
          // 칸 0 구단정보 0xd5 · 칸 1 아이템 0xd6
          if (action.kind === '상태') return actions.goto(action.target)
          // 칸 3 — this+0x16c = 1(타자기록) · 창 0x80
          if (action.kind === '기록순위창') return setRecordPick('타자')
          // 칸 2 — this+0x110 = 2 · 0xdf. 이전 상태가 0xcd 라 탭은 1(투수)
          setPlayerPick({ purpose: PLAYER_PICK_PURPOSE.선수정보, tab: ENTRY_TAB.투수, cursor: 0 })
          actions.goto(SEASON_SCENE_STATE.선수고르기)
        }}
        onBack={backToManagement}
      />
    )
  }

  if (scene === SEASON_SCENE_STATE.국가대항전 && cup !== null) {
    return (
      <NationalCupScreen
        mode="시즌모드"
        cup={cup}
        yearIndex={state.record.yearIndex}
        gamePoint={session.gamePoints}
        random={random}
        // ⚠️ 웹판 임시 — 원본은 여기서 사람이 대표팀을 조작해 경기를 친다 (시즌 221)
        onStartGame={(matchup) => actions.playCupGame(matchup.myTeam, matchup.opponent)}
        onFinish={(finish) => actions.finishCup(finish)}
        // 0xf3 갱신 0xe684 — 틀마다 0x65de5(전역, 0) 대한민국 · 우승국(SR+0x144)이 10 이면 결승 상대도 연다. 처음 열리면
        // 0x65de4 가 전역 +0x7a+k = 1 · 저장 · StrCOMMON[138] 팝업 0x22 (나리 134 진입 0x19f30 과 같은 함수)
        openedHiddenIds={[...(hallOfFame?.openedHiddenIds ?? []), ...session.openedHiddenIds]}
        onOpenHiddenTeams={actions.openCupHiddenTeams}
        // 공통 앞그림 0xb810 — 0xf3 · 0xf4 는 0xdd · 0xe0 · 0xe1 밖이라 공 무늬를 먼저 깐다(그림 0x896c 는 화면을 안 지운다)
        underlay={<SkinBackdrop kind="공무늬" />}
      />
    )
  }

  // ── 시즌 끝 사슬 (0xee → 0xeb → 0xec → 0xed → 0xf0 → 0xef) ──────────────────
  // 그리기는 모두 0x9fe4 → 공통 틀 0x9f60(0xee 는 가운데 판 없음)이고, 진입 함수가 phase 를 세우고 이벤트
  // (392 · 370 · 371 · 376 · 401~403)를 튼다. 세션이 들어온 틀에 곧장 0xd3 으로 넘기므로 한 틀만 그린다.
  // 시상 내용은 이벤트의 system 3 · 4 창, 결과 이벤트는 세션의 실행기 끝 갈래(0x8b04c · 0x8b370)가 맡는다
  if (
    scene === SEASON_SCENE_STATE.포스트시즌시작 || scene === SEASON_SCENE_STATE.정규시즌순위
    || scene === SEASON_SCENE_STATE.타자시상 || scene === SEASON_SCENE_STATE.투수시상 || scene === SEASON_SCENE_STATE.최우수선수
  ) {
    return (
      <SeasonChainFrameScreen state={state} gamePoint={session.gamePoints} cursor={session.menuCursors.management}
        showsCenterStage={scene !== SEASON_SCENE_STATE.포스트시즌시작} />
    )
  }

  if (scene === SEASON_SCENE_STATE.시즌결산) {
    return (
      <SeasonSummaryScreen
        record={state.record}
        series={series}
        // 0xb7aa0(리그, 팀, 0) — 0 우승 · 1 준우승(한국시리즈에서 진 팀) · 그 밖은 보상 없음.
        // 웹 entities/league 에 이 함수가 없어 시리즈 결과에서 바로 읽는다
        postseasonRank={postseasonRankOf(series, state.record.teamId)}
        leagueFirstAwardedBits={session.leagueFirstAwardedBits}
        entry={session.summaryEntry}
        onLeagueFirstAward={actions.awardLeagueFirst}
        onContinuePostseason={actions.continuePostseason}
        onFinish={actions.finishSeason}
        gamePoint={session.gamePoints}
      />
    )
  }

  if (scene === SEASON_SCENE_STATE.엔딩) {
    return (
      <SeasonEndingScreen
        // 엔딩 번호는 레코드에서 다시 판정한다 (0xa3084). 여기 올 때 레코드가 그대로라 값이 같다.
        // ⚠️ 원본은 판정값 e 를 `저장+0xa0+e` 에 남기지만 그 전역 저장 칸이 웹에 없다 — **근사다**.
        // 손댄 세이브 등으로 10년차가 아닌 채 phase 6 이면 0(비 인기 구단)으로 둔다
        endingIndex={judgeSeasonEnding(state.record) ?? 0}
        // SR+0x7b — 판정 0 은 진입 0x6be8 이, 그 밖은 보너스 팝업 0x2b 닫힘(0x8bd8)이 세운다. 서 있으면 키 0x6b3c 가 팝업 없이 넘긴다
        isBonusReceived={state.record.endingBonusReceived}
        onBonusReceived={actions.receiveEndingBonus}
        // 키 0x6b3c → 단계 1 → 전환이 끝나면 0x8bd8 8ccc~8d2c: SR+0x1bc = 1 · 저장 · **관리 메뉴 0xc9**(메인 메뉴가 아니다)
        onFinish={() => {
          actions.finishEnding()
          setEndingFadeIn(true)
        }}
      />
    )
  }

  // 경기 뒤 마무리 0xf1 — 같은 날 다른 네 경기 결과판 (그림 0xb400, SR+0x1c0). 확인 키 0x49a4
  if (scene === SEASON_SCENE_STATE.경기뒤마무리) {
    return (
      <DayResultBoardScreen board={state.record.dayBoard} onConfirm={actions.confirmDayResults}
        gamePoint={session.gamePoints} />
    )
  }

  if (scene === SEASON_SCENE_STATE.관중수입) {
    // 0xe9 는 그리기가 없다 — 진입 틀에 이벤트를 쌓기 전 한 틀은 빈 화면
    if (session.incomeEvaluation === null) return <RawScreen>{null}</RawScreen>
    return (
      <GameIncomeScreen
        record={state.record}
        teamMorale={state.teamMorale}
        gamePoint={session.gamePoints}
        line={session.incomeEvaluation.line}
        storeExpired={session.incomeEvaluation.storeExpired}
        goals={{ labelSet: SEASON_YEAR_GOAL_LABEL_SET, ...seasonGoalWindowNumbersFor(goalSource) }}
        // 0xd3 이 끝나면 0xdea0 이 걸어 둔 다음 상태로 — 구내매점은 0xe9 진입이 이미 줄였다
        onDone={() => actions.confirmIncome(state.record)}
      />
    )
  }

  // 경기 — 사람이 팀을 조작한다 (모드 2)
  if (scene === SEASON_SCENE_STATE.경기직전 && gameOptions !== null) {
    return (
      <TeamGameScreen
        options={gameOptions}
        random={random}
        onFinish={actions.finishGame}
        // 경기 중 "나가기" — 경기 상태 0x22(0x40140)는 모드를 가리지 않고 메인 메뉴(장면 0x103)로 나간다. +0x4e 와 블록은
        // 남아 다음 시즌모드 진입이 그 자리에서 다시 세운다
        onQuit={() => {
          actions.leaveGame()
          onExit()
        }}
        // 이어하기 — 저장 블록에서 다시 세운다 (0x213c0(앱, 2, 0) → 장면 0x104)
        {...(session.resumeGame === null ? {} : { resumeFrom: session.resumeGame })}
        // 0xdd OK 0x847e · 반 이닝 0x4f928 · 장면 진입 0x3a426 — +0x4e = 1 과 블록
        onHalfInningSave={actions.saveGameProgress}
        // 정산 진입 0x4ea0c → 0x4f3d6 — +0x4e = 0
        onSettlementEnter={actions.enterGameSettlement}
        // 자동진행 비용은 전역 저장 +0x64 에서 나간다 (시즌 사용내역 종류 3, 0x22c29)
        gamePoint={session.gamePoints}
        onSpendGamePoint={actions.spendGamePoint}
        settings={gameSettings.settings}
        onSettingsChange={gameSettings.setSettings}
        // 장착한 관중석·전광판 — **홈경기일 때만** 넘긴다 (원본 0x40ff0: 모드 2 이고
        // `0xb6bdc(경기, 1) == SR[1]`, 곧 내 팀이 side 1 = 홈일 때만 시즌 구장 0x77494).
        // 웹에서 그 side 를 정하는 것은 `0xb7844` 의 세 가지(정규 `leagueSideOf` ·
        // 포스트시즌 `postseasonSideOf` · 국가대항전 `nationalCupSideOf`) 고, 그 값이 그대로
        // `playerSide` 다 — side 1 = 후공 = 홈. 원정이면 undefined 라 일반 구장으로 그려진다.
        //
        // ⚠️ **국가대항전은 홈이어도 일반 구장이다.** 경기 준비 0x6650 이 `경기[0x28+side]` 에
        // 넣는 값이 대표팀 번호(10 대한민국 ~ 13 미국)인데, 비교 상대인 `SR[1]`(내 구단)은
        // 시즌모드에서 0~9 뿐이라(히든 팀은 일반모드에서만 고른다 — J-1) 절대 같아지지 않는다.
        seasonStadium={
          gameOptions.playerSide === PLAYER_SIDE_LAST_BAT && session.gameKind !== '국가대항전'
            ? seasonStadiumOf(state.record)
            : undefined
        }
        // 상태 0xe 소개 판 0x44944 의 시즌 줄 — 레코드 +0x20~ 의 웹 자리(리그 기록표)와, 이 경기 줄을 더할지:
        // 기록 게이트 0xa56dc 모드 2 갈래(0xa56fa)는 국가대항전·포스트시즌이면 거짓, 그 밖엔 마선수만 거짓(받는 쪽이 거른다)
        matchupRecords={{ stats: playerStats, countsThisGame: session.gameKind === '정규' }}
      />
    )
  }

  if (scene === SEASON_SCENE_STATE.다음경기) {
    // 0xd8 — 리그 순위표 한 장 (그림 0xae24 → 0x7f070). 확인은 경기로, 취소는 관리 메뉴에서 왔을 때만
    return (
      <NextGameScreen league={league} onConfirm={actions.confirmNextGame} onCancel={actions.cancelNextGame}
        isFromManagement={session.isNextGameFromMenu} gamePoint={session.gamePoints} />
    )
  }

  return (
    <RawScreen>
      <MessageBox
        text={`이 화면은 아직 없습니다 (장면 0x${scene.toString(16)})`}
        buttons={['OK']}
        onAnswer={backToManagement}
      />
    </RawScreen>
  )
}

/**
 * 내 팀의 포스트시즌 순위 — 원본 `0xb7aa0(리그, 팀, 0)` 자리다.
 * **0 우승 · 1 준우승(한국시리즈에서 진 팀)** 이고, 그 밖에는 보상이 붙지 않는다.
 * `entities/league` 에 같은 함수가 없어 시리즈 결과에서 읽는다.
 */
function postseasonRankOf(series: PostseasonSeries | null, teamId: number): number {
  if (series === null || series.round !== '종료') return NO_POSTSEASON_REWARD
  if (series.champion === teamId) return 0
  return series.teams.includes(teamId) ? 1 : NO_POSTSEASON_REWARD
}

/** 우승도 준우승도 아닐 때 넘기는 값 — 결산 화면이 보상을 붙이지 않는다 */
const NO_POSTSEASON_REWARD = 2
