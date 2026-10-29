import { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
import { PitcherCreateFlow } from '@/pages/pitcher-league/ui/PitcherCreateFlow'
import { nariGameRecordOf } from '@/entities/career/model/nariCupTeams'
import { nariRecordFieldersOf } from '@/entities/career/model/nariTeamRecord'
import { useEffect } from 'react'
import { castOfTeamRecordEquipment, stageSpritePreloadsOf } from '@/app/model/gameSpritePreload'
import { preloadSprites } from '@/shared/lib/sprite/scenePreload'
import { PitcherManagementScreen } from '@/pages/pitcher-league/ui/PitcherManagementScreen'
import { PitcherEventUnderlay } from '@/pages/pitcher-league/ui/PitcherEventUnderlay'
import { PitcherStatusBoard } from '@/pages/pitcher-league/ui/PitcherStatusBoard'
import { NariMainCommandBar } from '@/pages/management/ui/NariMainCommandBar'
import { PitcherResumeManagementFrame } from '@/pages/pitcher-league/ui/PitcherResumeManagementFrame'
import { nariMainCursorOnEntry } from '@/pages/management/model/nariMainMenuCursor'
import { useNariMainCursor } from '@/app/model/useNariMainCursor'
import { usePreviousDistinct } from '@/shared/lib/renderMachine/usePreviousDistinct'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { useEventEndFrame } from '@/app/model/useEventEndFrame'
import { OutingMapUnderlay } from '@/pages/management/ui/OutingMapUnderlay'
import { NextGameStandingsScreen } from '@/pages/management/ui/NextGameStandingsScreen'
import { NariMatchInfoScreen } from '@/pages/management/ui/NariMatchInfoScreen'
import { EntryEditorScreen } from '@/widgets/entry-editor'
import { MatchInfoStadiumBackdrop } from '@/widgets/batting-stage/ui/MatchInfoStadiumBackdrop'
import { pitcherCupMatchInfoOf, pitcherMatchInfoOf } from '@/pages/pitcher-league/lib/pitcherMatchInfo'
import { NationalCupScreen } from '@/pages/national-cup/ui/NationalCupScreen'
import { NariScreenPush } from '@/pages/management/ui/NariScreenPush'
import { NariYearCoverScreen, YearCoverHoldLayer, YearCoverResumeLeftFrame } from '@/pages/management/ui/NariYearCoverScreen'
import { YEAR_COVER_ENTRY_FRAMES, resumeCoverUnderlayAt } from '@/pages/management/lib/nariYearCover'
import { SeasonScreenFade } from '@/pages/season/ui/SeasonScreenFade'
import { PitcherGameEvaluationScreen } from '@/pages/pitcher-league/ui/PitcherGameEvaluationScreen'
import { PitcherGameScreen } from '@/pages/pitching/ui/PitcherGameScreen'
import { PitcherShopScreen } from '@/pages/shop/ui/PitcherShopScreen'
import { EndingScreen } from '@/pages/ending/ui/EndingScreen'
import { SeasonOutingPopup } from '@/pages/season/ui/SeasonOutingPopup'
import { nariOutingPresentationOf } from '@/pages/season/lib/seasonOutingPopup'
import { portraitPaletteIndex } from '@/shared/lib/sprite/paletteSwap'
import { OutingMapScreen } from '@/pages/outing-map/ui/OutingMapScreen'
import { StoryScreen } from '@/pages/story/ui/StoryScreen'
import { PITCHER_YEAR_START_EVENT } from '@/entities/pitcher-career/model/pitcherStoryScene'
import { rewardNoticeContextOf } from '@/entities/story/model/rewardNotice'
import { PITCHER_LEAGUE_MODE } from '@/entities/collection/model/annalsStats'
import { awardWindowTextOf } from '@/pages/story/lib/awardWindows'
import { pitcherYearGoalWindowValuesOf } from '@/entities/pitcher-career/model/pitcherYearGoals'
import { PostseasonScreen } from '@/pages/season-end/ui/PostseasonScreen'
import { MessageBox, ScreenOverlay } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import { nationalCupStandingsTitleOf } from '@/entities/career/model/titles'
import { TitleWindow } from '@/widgets/title-window/ui/TitleWindow'
import { isContinuablePitcherEnding, judgePitcherSeasonAwards, pitcherEndingBonusOf } from '@/entities/pitcher-career/model/pitcherSeasonFlow'
import { PITCHER_EDITION_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import type { ReactNode } from 'react'
import { EMPTY_COLLECTION } from '@/entities/collection/model/collection'
import type { Collection, HallOfFameResult } from '@/entities/collection/model/collection'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { HallOfFameNariPlayer } from '@/pages/special/ui/SpecialScreen'
import { nariPitcherOf } from '@/app/model/useCollection'
import type { PitcherAceMatch, PitcherLeagueSession } from '@/app/model/usePitcherLeagueSession'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { useGameSettings } from '@/app/model/useGameSettings'
import { SceneHourContext, useSceneEntryHour } from '@/shared/lib/phoneClock/phoneClock'

interface PitcherLeagueRouteProps {
  readonly session: PitcherLeagueSession
  readonly random: RandomPort
  readonly openedHiddenIds?: readonly number[]
  /** 경기 중 메뉴 "설정" 칸 */
  readonly gameSettings: ReturnType<typeof useGameSettings>
  /** 메인 메뉴로 나간다 — `openTier` 5 는 전역 [0x140006c] = 5(게임시작 목록으로 바로, 105 취소 0x126e6). 없으면 처음 단 */
  readonly onExit: (openTier?: 5) => void
  /** 명예의 전당 등록 목록 (나리 상태 145, 모드 3) — 기록연감·칸 5 나리 타자·등록 (G·통계는 App 이 지갑으로 치른다) */
  readonly hallOfFame?: {
    readonly collection: Collection
    readonly nariBatter: HallOfFameNariPlayer | null
    readonly register: (career: PitcherCareer, slot: number | null) => HallOfFameResult['kind']
    /**
     * 완료 창(꼬리표 0x30)을 닫았을 때 0x1ca4c 가 여는 히든 17(전광판 "고대의전광판") — 열고 알림을 띄웠으면 참이고
     * 그 창을 닫을 때 `then` 을 부른다 (`SpecialScreen` 등록 모드의 같은 이름 머리말)
     */
    readonly openRegisteredHidden?: (then: () => void) => boolean
    /** 전역 G(`mgr+0x64`) — 등록 목록(상태 145) 머리띠 0x54d95 가 그린다 */
    readonly gamePoint?: number
  }
  /**
   * 마선수 대결 화면 — 투수 미션 레코드(team − 1)를 사람이 던지는 미션 장면(모드 5). 끝나면 `onFinish(이겼나)`.
   */
  readonly renderAceMatch: (match: PitcherAceMatch, onFinish: (isWin: boolean) => void) => ReactNode
}

/**
 * 투수편 라우트 — 나리 장면 0x106 의 시간대 시각(상태 100 진입 0x1c154 끝 `0x7b934(gfx, 0xb8fbd())`)을 장면에 들어설 때 잡아
 * 안쪽 화면에 내려 준다(`SceneHourContext`). 경기(0x104) · 마선수 대결 경기 동안은 나리 장면이 내려가 있다.
 */
/** 이어하기 길 137 앞의 연초 114 — 재생기에 싣는 이벤트는 내장 연초 이벤트 하나다(0x8a681, 타자편과 같다) */
const PITCHER_YEAR_START_EVENTS = [PITCHER_YEAR_START_EVENT] as const
/** 그 114 는 효과기 끝(9 틀째)에 끊긴다 — 재생이 끝나거나 경기를 거는 일은 없다 */
const ignoreEventEnd = () => {}

export function PitcherLeagueRoute(props: PitcherLeagueRouteProps) {
  const { scene, gameOptions } = props.session
  const isInNariScene = !(scene === '경기' && gameOptions !== null) && scene !== '마선수대결'
  const hour = useSceneEntryHour(isInNariScene)
  // 상대 팀 레코드의 굴린 장비 니블(나리 새 시즌 0x665e8) — 타석 교대 0x47cc8 이 상대 타자(47e80 → 0x78fd8)에 싣는다.
  // 경기 옵션이 서면 그 그림을 유휴로 받는다(안 기다린다)
  const opponentTeamId = gameOptions?.opponentTeamId
  const opponentEquipment = gameOptions?.opponentEquipment
  useEffect(() => {
    if (opponentTeamId === undefined || opponentEquipment === undefined) return
    preloadSprites(stageSpritePreloadsOf(castOfTeamRecordEquipment(opponentTeamId, opponentEquipment)), 'idle')
  }, [opponentTeamId, opponentEquipment])
  return (
    <SceneHourContext.Provider value={hour}>
      <PitcherLeagueScreens {...props} />
      {/* 새 시즌 0x1b768 을 부른 134 · 141 이 효과기 끝을 기다리는 아홉 틀 — 그 화면을 그대로 두고 효과기만 덮는다 */}
      {props.session.isYearCoverHeld ? <YearCoverHoldLayer onDone={props.session.actions.enterHeldYearCover} /> : null}
    </SceneHourContext.Provider>
  )
}

/**
 * 나만의리그 **투수편** 라우팅 (원본 게임 모드 3, 장면 0x106).
 *
 * 등록(0x65 → 0x66) → 관리(상태 105 허브) → 경기 → 정산 한 바퀴를 돌다가,
 * 45경기를 다 치르면 116 끝이 곧장 **136(392) → 130·131 → 포스트시즌 대진(128) → 연말(132) → 엔딩(141)** 이벤트 사슬로 빠진다.
 * 관리 화면 안의 선수정보·트레이닝·구질 훈련·휴식은 `PitcherManagementScreen` 이 스스로 돈다.
 *
 * [외출] → **112 외출 지도** 는 타자편 화면(`OutingMapScreen`)을 그대로 쓴다 — 원본 모드 3·4 가 같은 상태·
 * 같은 코드(지도 0x7ea64 · 장소 0x16c64 · 효과 0x15234 · [!] 배정 0x8cdc0)를 돈다.
 * **114 이벤트 재생**은 타자편 `StoryScreen` 을 그대로 쓴다 — 원본도 모드 3·4 가 같은 재생기(0x8be20 · 0x8b804)다.
 * 주인공 초상화는 피부 팔레트만 따른다: 장타형 +8(0x63a70)은 `모드 == 4` 일 때만이라 투수는 늘 +0 이다.
 * 상점은 [아이템] → 110 → **111 상점**(장비·서브·GP) · [선수정보] → **121 장비착용** 이 `PitcherShopScreen` 으로 간다.
 */
function PitcherLeagueScreens({ session, random, openedHiddenIds = [], gameSettings, onExit, renderAceMatch, hallOfFame }: PitcherLeagueRouteProps) {
  const { career, scene, gameOptions, shopTab, shopNotice, shopGpDetail, actions } = session
  /** 이전 장면 — 105 진입 0x11910 이 이전 상태 1 · 114 · 100 이면 가운데 판을 미끄러뜨린다 (0x8a2d8) */
  const previousScene = usePreviousDistinct<string>(scene)
  /**
   * 관리 메뉴 [this+0x8c] 의 커서 — 타자편 `CareerRoutes` 와 같다(`NariMainMenuCursor`). 105 에 들어올 때마다(관리 장면, 또는
   * 105 진입 곁가지로 바로 뜬 '관리' 이벤트) 0x11910 규칙: 행동함이고 이전이 109 · 110 이 아니면 첫 칸. 상점(111 · 121)에서
   * 돌아오면 105 가 아니라 하위 메뉴(110 · 106)로 선다(`nariReturnSubMenuOf`) — 이 규칙을 안 친다.
   */
  /**
   * 142 경기 준비 그림 0x15d98 의 0x63b15 넷째 인자 = `[장면+0x28] ≠ 0x8f` — 이전 상태가 143(엔트리 보기)이 아니면
   * 머리띠 미끄러짐 · 배너 연출을 켠다 (`pages/management/lib/matchInfoEntry`).
   */
  const matchView = scene === '경기준비' ? (session.entryView === null ? '142' : '143') : null
  const isMatchInfoEntryAnimated = usePreviousDistinct(matchView) !== '143'
  const entryKey =
    career === null
      ? null
      : scene === '관리'
        ? '관리'
        : scene === '이벤트' && session.story?.context === '관리'
          ? `이벤트:${session.story.eventId}`
          : null
  // 열쇠가 있으면 커리어가 있다(커리어가 없으면 열쇠는 null)
  const mainCursor = useNariMainCursor({
    entryKey,
    isEventScreen: scene === '이벤트',
    previous: previousScene,
    subMenuScreen: '상점',
    hasActedThisCycle: career?.hasActedThisCycle ?? false,
  })
  /** 114 재생이 끝난 한 틀 — 대화창 없이 0x19da4 를 그린 뒤 넘긴다 (`useEventEndFrame`) */
  const eventEnd = useEventEndFrame(actions.completeStory)

  if (career === null || scene === '등록') {
    return (
      <PitcherCreateFlow
        openedHiddenIds={openedHiddenIds}
        onCreate={actions.create}
        {...(hallOfFame?.gamePoint === undefined ? {} : { gamePoint: hallOfFame.gamePoint })}
        // 101 팀 고르기 취소 0x14114 1424c~14264: [0x140006c] = 5 — 게임시작 목록으로 바로 연다([0x1552d14] = 1 은 전역 모드를 일반으로)
        onCancel={() => onExit(5)}
      />
    )
  }

  if (scene === '경기' && gameOptions !== null) {
    return (
      <PitcherGameScreen
        options={gameOptions}
        pitcherName={career.name}
        // 소개 판 0x44944 의 시즌 줄 — 내 투수 레코드 +0x20~(커리어 시즌 줄, 이 경기 앞) · 상대 타자는 리그 기록표
        matchupRecords={{ mySeason: career.stats, stats: career.leaguePlayerStats }}
        // 마운드 내 투수 그림의 장비 겹 (0x108f8 모드 ≠ 4 → 0x79368 · 0x10810 → 0x79790)
        pitcherEquipmentLevels={career.equipmentLevels}
        pitcherSkinIndex={career.skinIndex}
        // 두 팀 레코드 타자 배열 차례 — 교대 판 이름표 0x40008 · 운동장 마선수 그림 0x79b48 이 훑는다 (경기 장면 0x39fdc 의 0xb891c 모드 3)
        fieldLineups={{
          ours: nariRecordFieldersOf(nariGameRecordOf(career, gameOptions.ourTeamId), gameOptions.ourTeamId, null),
          opponent: nariRecordFieldersOf(nariGameRecordOf(career, gameOptions.opponentTeamId), gameOptions.opponentTeamId, null),
        }}
        // 정산 판(0x4a384) 보유 GP 줄 — 전역 G [app+0x64] (커리어 칸은 지갑과 다리로 이어진다). 판이 이 경기 G 를 더해 보인다
        gamePoint={career.gamePoint}
        random={random}
        onFinish={actions.finishGame}
        // 경기 중 "나가기" — 상태 0x22 갱신 0x40140 은 모드를 가리지 않고 0x140006c = 4 · 장면 0x103(메인 메뉴 처음 단).
        // 관리(105)로 가지 않는다. 저장·+0x4f 는 그대로라 [14]·[최근게임] 이 곧장 경기로 다시 세운다
        onQuit={() => {
          actions.quitGame()
          onExit()
        }}
        settings={gameSettings.settings}
        onSettingsChange={gameSettings.setSettings}
      />
    )
  }

  // 116 경기 뒤 평가 — [확인] = 114 → 105/109/128/136
  if (scene === '경기결과' && career.lastGame !== undefined) {
    return (
      <PitcherGameEvaluationScreen
        career={career}
        lastGame={career.lastGame}
        onConfirm={actions.confirmGameResult}
        onRewardsGiven={actions.giveEvaluationRewards}
      />
    )
  }

  const management = (
    <PitcherManagementScreen
      career={career}
      random={random}
      onSave={actions.save}
      // [다음경기] → 109 순위표 → 확인 → 경기
      onNextGame={actions.openNextGameStandings}
      onOuting={actions.openOuting}
      onOpenShop={actions.openShop}
      // 105 취소 0x1261c 126e6~126fa: 0x375d · [0x140006c] = 5 · 장면 0x103 — 메인 메뉴를 게임시작 목록으로 바로 연다
      onExit={() => onExit(5)}
      onReenter={actions.reenterManagement}
      onResultWindowChange={actions.setResultWindowOpen}
      onMainConfirm={actions.pressManagementConfirm}
      // 114(이벤트) · 100(경기 뒤 — 경기결과) · 1(처음 선다)
      centerSlidesIn={previousScene === null || previousScene === '이벤트' || previousScene === '경기결과'}
      mainCursor={mainCursor}
    />
  )

  if (scene === '다음경기순위') {
    return (
      <NextGameStandingsScreen
        league={career.league}
        edition="투수편"
        gamePoint={career.gamePoint}
        isFromManagement={session.nextGameFromManagement}
        onConfirm={actions.confirmNextGameStandings}
        onCancel={actions.cancelNextGameStandings}
      />
    )
  }

  if (scene === '경기준비') {
    // 142 ↔ 143 은 화면 밀기(효과기 종류 8, 0xbdae9(…, 8, 0, 3/4, 1000))로 바뀐다 (`NariScreenPush` — 타자편과 같다)
    const entryView = session.entryView
    const pushView = entryView === null ? '142' : entryView.isMyTeam ? '143:내팀' : '143:상대'
    // 143 경기 전 엔트리 보기 — 진입 0x16af8 · 키 0x1457c · 그림 0x16738 (보기 전용, 끝 코드로 142 로 돌아간다)
    if (entryView !== null) {
      return (
        <NariScreenPush view={pushView}>
          <EntryEditorScreen
            editor={entryView.editor}
            lists={entryView.lists}
            teamName={TEAMS[entryView.teamId]?.name ?? ''}
            isAceLocked={false}
            gamePoint={career.gamePoint}
            onKey={actions.pressEntryViewKey}
            onMoveCursor={actions.pointEntryViewCursor}
            onCloseAceLocked={() => {}}
            // 나리 틀 0x16928 은 142~144 면 142 진입이 떠 둔 구장 바탕(0x581dc)을 깐다
            underlay={<MatchInfoStadiumBackdrop stage={session.matchInfoStage} />}
            slides={false}
          />
        </NariScreenPush>
      )
    }
    // 142 경기 준비 — 진입 0x1c46c · 키 0x13c30 · 그림 0x15d98 (타자편과 같은 상태)
    // 국가대항전(135 에서 옴)이면 대회 표 · 마선수 "-" (1c5fe)
    const match =
      session.cupMatch === null
        ? pitcherMatchInfoOf(career, session.matchAces)
        : pitcherCupMatchInfoOf(career, session.cupMatch.matchup, session.cupMatch.cup)
    return (
      <NariScreenPush view={pushView}>
        <NariMatchInfoScreen
          lines={match.lines}
          myTeamId={match.myTeamId}
          opponentTeamId={match.opponentTeamId}
          playerSide={match.playerSide}
          edition="투수편"
          gamePoint={career.gamePoint}
          stage={session.matchInfoStage}
          onStart={actions.confirmMatchPrepare}
          onCancel={actions.cancelMatchPrepare}
          onEntry={actions.openEntryView}
          isEntryAnimated={isMatchInfoEntryAnimated}
        />
      </NariScreenPush>
    )
  }

  const outingMap = (
    <OutingMapScreen
      noticeText={session.outingNotice}
      onCloseNotice={actions.closeOutingNotice}
      onRun={actions.runOutingFunction}
      // 112 취소 → 105 (키 0x13ba4) — 원본 13bc0~13bca 는 S+4(행동함) = 0 으로 내린다(두 편 공용 키). B-26 고침이면 들어설 때 값으로
      onBack={() => {
        const acted = actions.actedAfterOutingCancel()
        if (career.hasActedThisCycle !== acted) actions.save({ ...career, hasActedThisCycle: acted })
        actions.goto('관리')
      }}
      // 장소 이벤트 배정 0x8cdc0 — 장소마다 파일 순서 첫 이벤트(대상 1·3)
      eventPlaceIds={session.eventPlaceIds}
      onEnter={actions.enterOutingPlace}
      // 빈 장소(440~444) 뒤는 113 그 장소 말풍선 · 113 취소는 112 에 다시 들어선다(Q-22)
      initialOpenPlaceId={session.outingReturnPlaceId}
      onCloseBubble={actions.reenterOutingMap}
      // 126 효과 팝업 → [확인] → 105 (입원 회복 글은 관리 화면 위 팝업으로)
      resultText={session.outingResult?.effectText ?? null}
      onCloseResult={actions.closeOutingResult}
      presentation={
        session.outingPresentation === null ? null : (
          <SeasonOutingPopup
            place={session.outingPresentation.place}
            presentation={nariOutingPresentationOf(session.outingPresentation.place, { isSlugger: false })}
            char0Palette={portraitPaletteIndex(career.skinIndex)}
            onFinished={actions.finishOutingPresentation}
          />
        )
      }
    />
  )

  if (scene === '이벤트' && session.story !== null) {
    const { story } = session
    const event = session.storyEvents?.find((candidate) => candidate.id === story.eventId)
    // 이벤트 본문이 오기 전에는 관리 화면을 깔아 둔다
    if (session.storyEvents !== null && event !== undefined) {
      // 114 그림 0x19e64 → 대화창 0x8b5ac: [gfx+0x174] 가 0x70·0x71(112 · 113 · 140 진입)이면 외출 지도, 그 밖(105 · 115 ·
      // 116 · 117 · 130~138 뒤)은 공 무늬 + 상태판 + 머리띠 (`PitcherEventUnderlay`) — 커맨드 줄은 없다.
      // 지도(112) · 장소(113) · 대결결과(140) 뒤는 지도 0x7ea64(gfx, −1, 0) 만 — 선택 화살표 · 말풍선 · 머리띠 없음 (`OutingMapUnderlay`)
      const isOverStatusBoard = story.context === '관리' || story.context === '중간평가' || story.context === '연초' || story.context === '연말'
      const isOverMap = story.context === '지도' || story.context === '장소' || story.context === '대결결과'
      // 재생이 끝난 한 틀 — 타자편과 같은 0x19e64: 앞 상태 112 · 113 만 지도, 그 밖(140 포함)은 0x19da4 = 공 무늬 · 상태판(0) ·
      // 커맨드 줄(앞 상태 105 = '관리' 갈래만 관리 6칸, 그 밖 칸 수 0) · 머리띠 제목 9
      if (eventEnd.isEnding) {
        if (story.context === '지도' || story.context === '장소') {
          return (
            <RawScreen>
              <OutingMapUnderlay eventPlaceIds={session.eventPlaceIds} />
            </RawScreen>
          )
        }
        return (
          <RawScreen>
            <SkinBackdrop kind="공무늬" />
            <PitcherStatusBoard career={career} />
            {story.context === '관리' && <NariMainCommandBar menuEnable={career} cursor={mainCursor.current} />}
            <ScreenFrame title="나만의리그투수편" gamePoint={career.gamePoint} onBack={null} footer={5} slides={false} />
          </RawScreen>
        )
      }
      // 밑그림은 240×320 판(RawScreen) 안에, 대사창 덮개(ScreenOverlay)는 그 형제로 — 밑그림을 안 감싸면 창 왼쪽 위(−120, −240)에 어긋나 그려졌다
      return (
        <>
          <RawScreen>
            {isOverStatusBoard && <PitcherEventUnderlay career={career} />}
            {isOverMap && <OutingMapUnderlay eventPlaceIds={session.eventPlaceIds} />}
          </RawScreen>
          <ScreenOverlay>
            <StoryScreen
              // 명령 5 의 500ms 진동(0x3a44)은 환경설정 진동(옵션 +0x3b)이 켜졌을 때만
              isVibrationOn={gameSettings.settings.isVibrationOn}
              // 초상화 바닥 y — [gfx+0x174] 0x70 · 0x71 이면 252, 그 밖 135 (0x7fdee)
              isOverOutingMap={isOverMap}
              key={`${story.context}:${event.id}`}
              events={session.storyEvents}
              event={event}
              playerName={career.name}
              teamName={(TEAMS[career.teamId] ?? TEAMS[0]).name}
              skinIndex={career.skinIndex}
              battingTypeIndex={0}
              replacementsFor={session.storyReplacementsFor}
              onComplete={eventEnd.end}
              carried={story.carried}
              onMatch={actions.beginAceMatch}
              // 370·375 의 system 3·4 — 타이틀(0x8b3bc, 투수 문구 79~81 · 마무리 82)·MVP(0x8b23c) 발표 창 (130·131 과 같은 판정)
              systemWindowTextOf={(command) => awardWindowTextOf(command.sub, () => judgePitcherSeasonAwards(career))}
              // system 1 올해의 목표 창 — 연초 115 · 392 (0x8d304 → 0x86fdc)
              yearGoalWindowOf={() => pitcherYearGoalWindowValuesOf(career)}
              // 보상 명령 7 의 알림 창 — 0x8beb8 글 → 0x74ef4 종류 1 · 첫 종류 4 는 스킬 창 0x741a0 (모드 3 투수편)
              rewardNoticeContext={() => rewardNoticeContextOf(career, PITCHER_LEAGUE_MODE, random)}
              // system 창 답 0 → 0x7fe90 (S+0x1b7 = 1 · 저장)
              onSystemWindowConfirm={actions.confirmEventSystemWindow}
              // 보상 명령 7 은 창을 세운 그 갱신에 준다 (0x8c460)
              onReward={actions.giveStoryReward}
              // 선택지 OK → 0x8b0e4 (떠나온 줄 본 표시 · 저장)
              onChoiceConfirm={actions.confirmStoryChoice}
            />
          </ScreenOverlay>
        </>
      )
    }
  }

  if (scene === '마선수대결' && session.aceMatch !== null) {
    return <>{renderAceMatch(session.aceMatch, actions.finishAceMatch)}</>
  }

  // 128 포스트시즌 대진 — 타자편과 같은 화면·같은 상태 함수(모드 갈림은 해금 id 하나, `postseasonFlow`)
  if (scene === '포스트시즌') {
    return (
      <PostseasonScreen
        series={career.postseason}
        edition="투수편"
        gamePoint={career.gamePoint}
        popup={session.postseasonPopup}
        onConfirm={actions.pressPostseason}
        onClosePopup={actions.closePostseasonPopup}
      />
    )
  }

  // 국가대항전 134 대진 · 135 순위 — 타자편과 같은 상태·같은 화면 (모드 3·4 공용 0x19f30 · 0x19fdc · 0x10680)
  if (scene === '국가대항전' && session.cup !== null) {
    return (
      <NationalCupScreen
        mode="나만의리그"
        // 머리띠 0x169ea~0x16a00: 장면+0xcc(모드) == 4 ? 8 : 9 — 투수편(모드 3)은 제목 9 "나만의리그투수편"
        edition="투수편"
        cup={session.cup.cup}
        // 제 n 회 = (연차 idx >> 1) + 1 (0x85e6c) — 대회는 끝난 해의 연말이라 지금 시즌 − 1
        yearIndex={career.season - 1}
        gamePoint={career.gamePoint}
        random={random}
        onStartGame={actions.startCupGame}
        onFinish={actions.finishCup}
        // 142 취소로 돌아오면 135(순위표)부터
        initialStep={session.cup.atStandings ? '순위' : '대진'}
        // 134 진입 0x19f30 — 처음 열리는 히든 팀마다 StrCOMMON[138] 팝업 0x22 · 전역 해금. 전역 해금표(기록연감)까지 본다
        openedHiddenIds={[...career.openedHiddenIds, ...openedHiddenIds]}
        onOpenHiddenTeams={actions.openCupHiddenTeams}
        // 134 첫 틀 0x1b92c 머리 — 비트 8 이 없으면 칭호 8 "국가 대표" 팝업 0x78, 확인 0x1b1e4 가 주고 장착
        entryTitle={nationalCupStandingsTitleOf(career.titleIds)}
        onConfirmEntryTitle={actions.confirmCupTitle}
      />
    )
  }

  // 방출 이어하기 뒤 아홉 틀은 선수의 엔딩 칸이 이미 비었다 — 141 이 그리던 번호 그대로 (`heldEndingIndex`)
  const shownEndingIndex = career.endingIndex ?? session.heldEndingIndex
  if (scene === '엔딩' && shownEndingIndex !== null) {
    const endingIndex = shownEndingIndex
    return (
      <EndingScreen
        playerName={career.name}
        isResumed={session.endingFromResume}
        endingIndex={endingIndex}
        seenEventIds={career.seenEventIds}
        bonusGamePoint={pitcherEndingBonusOf(endingIndex)}
        // S+0x7b — 141 로 이어하기한 엔딩은 보너스를 이미 받았다. 팝업 0x2b 를 닫을 때 보너스 · S+0x7b · 저장 (1bbf4~1bc70)
        isBonusReceived={career.endingBonusReceived === true}
        onBonusReceived={actions.receiveEndingBonus}
        isContinuable={isContinuablePitcherEnding(endingIndex)}
        // 선수 애니 바탕은 모드 3 이면 0 으로 고정이다 (endingLayout `endingWalkInAnimationOf`)
        walkInLook={{
          mode: PITCHER_EDITION_MODE,
          typeIndex: career.typeIndex,
          handIndex: career.handIndex,
          skinIndex: career.skinIndex,
        }}
        // 명예의 전당 145 — 모드 3 은 투수 칸(+0x880, 기본 2칸)에 0x1f654 로 넣는다
        hallOfFame={{
          collection: hallOfFame?.collection ?? EMPTY_COLLECTION,
          edition: '투수',
          nari: { 투수: nariPitcherOf(career), 타자: hallOfFame?.nariBatter ?? null },
          // 등록이 된 그 순간 0x62dbe 가 모드 저장을 지운다(0x224ec) — 완료 창을 닫기 전이다
          onRegister: (slot) => {
            const result = hallOfFame?.register(career, slot) ?? '빈칸없음'
            if (result === '등록') actions.eraseSaveForHallOfFame()
            return result
          },
          ...(hallOfFame?.gamePoint === undefined ? {} : { gamePoint: hallOfFame.gamePoint }),
          ...(hallOfFame?.openRegisteredHidden === undefined ? {} : { openRegisteredHidden: hallOfFame.openRegisteredHidden }),
        }}
        onContinue={actions.continueAfterEnding}
        onFinish={(isRegistered) => {
          actions.finishEnding(isRegistered)
          // 141 끝 0x1bfd4 · 145 목록 0x1ca92 — 등록 여부와 상관없이 [0x140006c] = 5(게임시작 목록으로 바로)
          onExit(5)
        }}
      />
    )
  }

  if (scene === '상점') {
    // 해금표는 원본에서 전역(app+0xc0)이라 기록연감의 오픈 id 를 얹어 보여 준다 — 구매도 같은 값으로 판정한다
    const missing = openedHiddenIds.filter((id) => !career.openedHiddenIds.includes(id))
    const shopCareer = missing.length === 0 ? career : { ...career, openedHiddenIds: [...career.openedHiddenIds, ...missing] }
    return (
      <PitcherShopScreen
        key={shopTab}
        tab={shopTab}
        career={shopCareer}
        noticeText={shopNotice}
        gpDetail={shopGpDetail}
        onCloseGpDetail={actions.closeShopGpDetail}
        onPurchase={(itemId) => actions.purchase(itemId, openedHiddenIds)}
        // 111 취소 → 110 · 121 취소 → 106 — 관리 화면이 다시 열릴 때 그 하위 메뉴 그 칸에 선다(`nariReturnSubMenuOf`)
        onBack={() => actions.goto('관리')}
      />
    )
  }

  if (scene === '외출') return outingMap

  if (scene === '연차표지') {
    // 앞 화면 아홉 틀은 앞 상태가 매 틀 그린다 — 114 끝은 0x19da4(상태판 · 머리띠, 새 시즌의 S), 이어하기 길은 `resumeCoverUnderlayAt`.
    // 134 대진판 · 141 엔딩은 그 화면이 선 채 아홉 틀을 돌고(`YearCoverHoldLayer`) 표지는 그다음 틀부터 — 타자편 `CareerRoutes` 와 같다
    const statusBoard = <PitcherEventUnderlay career={career} />
    const previousScreenAt = session.yearCoverFromResume
      ? (frame: number) => {
          const underlay = resumeCoverUnderlayAt(frame)
          if (underlay === '앞판') return <YearCoverResumeLeftFrame frame={frame} />
          if (underlay === '관리')
            return (
              <PitcherResumeManagementFrame career={career} cursor={nariMainCursorOnEntry(mainCursor.current, career.hasActedThisCycle, false)} />
            )
          if (underlay === '상태판') return statusBoard
          // 연초 114 — 0x19e64 밑그림 위에 대화창 0x8b5ac(내장 이벤트 0x8a681 의 첫 say). 키는 장면 키 문이 버린다
          return (
            <>
              {statusBoard}
              <StoryScreen
                events={PITCHER_YEAR_START_EVENTS}
                event={PITCHER_YEAR_START_EVENT}
                playerName={career.name}
                teamName={(TEAMS[career.teamId] ?? TEAMS[0]).name}
                skinIndex={career.skinIndex}
                battingTypeIndex={0}
                isVibrationOn={gameSettings.settings.isVibrationOn}
                onComplete={ignoreEventEnd}
                onMatch={ignoreEventEnd}
                isInputLocked
              />
            </>
          )
        }
      : previousScene === '이벤트'
        ? () => statusBoard
        : undefined
    // 새 시즌 처리 뒤라 S+0xb3(= season − 1)은 이미 새 연차 idx 다 — 타자편과 같은 137
    return (
      <NariYearCoverScreen
        yearIndex={career.season - 1}
        onDone={() => actions.goto('관리')}
        previousScreenAt={previousScreenAt}
        {...(session.yearCoverAfterHold ? { startFrame: YEAR_COVER_ENTRY_FRAMES } : {})}
      />
    )
  }

  return (
    <>
      {management}
      {/* 137 틀 0x12190 이 105 를 예약하며 건 효과기 종류 2(밝아짐) — 칠하기 0 은 137 위였으니 105 는 1 부터 */}
      {scene === '관리' && previousScene === '연차표지' && <SeasonScreenFade kind="검게어두워짐" startFrame={1} />}
      {/* 관리 화면(RawScreen)의 형제라 240×320 기둥(ScreenOverlay)에 가둔다 — 안 가두면 창 판(left 0 · 폭 240)이 창 전체 왼쪽에 붙어 그려졌다.
          기둥은 누름을 받으므로 창이 있을 때만 세운다 */}
      {(session.outingRecoveryNotice !== '' || session.pendingTitle !== null) && (
        <ScreenOverlay>
          {/* 126 → 105 뒤 남는 입원 회복 팝업 (0x1575c `0xbbef8(글, 1, 1, 1)`) */}
          {session.outingRecoveryNotice !== '' && (
            <MessageBox text={session.outingRecoveryNotice} buttons={['확인']} onAnswer={actions.dismissOutingRecoveryNotice} />
          )}
          {/* 칭호 팝업 0x1274c — 그리기 0x1afe8(투수편 i > 31 이면 이름 [i+16] · 조건 [i+80]) · 키 0x1b1e4 (`TitleWindow`).
            키가 창을 그 자리에서 치우고 다음 갱신 0x1aec4 가 다음 칭호를 새 창으로 띄운다 — `key` 가 칭호마다 새 창을 세운다 */}
          {session.pendingTitle !== null && <TitleWindow key={session.pendingTitle} title={session.pendingTitle} onKey={actions.confirmTitle} />}
        </ScreenOverlay>
      )}
    </>
  )
}
