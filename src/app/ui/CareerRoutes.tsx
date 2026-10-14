import { useRef } from 'react'
import type { Screen } from '@/app/model/screen'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import type { useCareerSession } from '@/app/model/useCareerSession'
import { GameRoute } from '@/app/ui/GameRoute'
import type { useGameSettings } from '@/app/model/useGameSettings'
import { GameResultScreen } from '@/pages/game-result/ui/GameResultScreen'
import { ManagementScreen } from '@/pages/management/ui/ManagementScreen'
import { NextGameStandingsScreen } from '@/pages/management/ui/NextGameStandingsScreen'
import { NariMatchInfoScreen } from '@/pages/management/ui/NariMatchInfoScreen'
import { EntryEditorScreen } from '@/widgets/entry-editor'
import { MatchInfoStadiumBackdrop } from '@/widgets/batting-stage/ui/MatchInfoStadiumBackdrop'
import { batterMatchInfoOf, cupMatchInfoOf } from '@/pages/management/lib/nariMatchPrepare'
import { ShopScreen } from '@/pages/shop/ui/ShopScreen'
import { SeasonOutingPopup } from '@/pages/season/ui/SeasonOutingPopup'
import { nariOutingPresentationOf } from '@/pages/season/lib/seasonOutingPopup'
import { portraitPaletteIndex } from '@/shared/lib/sprite/paletteSwap'
import { OutingMapScreen } from '@/pages/outing-map/ui/OutingMapScreen'
import { ScreenOverlay } from '@/shared/ui'
import { StoryScreen } from '@/pages/story/ui/StoryScreen'
import { rewardNoticeContextOf } from '@/entities/story/model/rewardNotice'
import { BATTER_LEAGUE_MODE } from '@/entities/collection/model/annalsStats'
import { RecordScreen } from '@/pages/record/ui/RecordScreen'
import { SeasonEndScreen } from '@/pages/season-end/ui/SeasonEndScreen'
import { PostseasonScreen } from '@/pages/season-end/ui/PostseasonScreen'
import { NationalCupScreen } from '@/pages/national-cup/ui/NationalCupScreen'
import { NariScreenPush } from '@/pages/management/ui/NariScreenPush'
import { NariEventUnderlay } from '@/pages/management/ui/NariEventUnderlay'
import { NariMainCommandBar } from '@/pages/management/ui/NariMainCommandBar'
import { createNariMainMenuCursor, nariMainCursorOnEntry } from '@/pages/management/model/nariMainMenuCursor'
import { isBattingOrderEventId } from '@/entities/career/model/battingOrder'
import { useEventEndFrame } from '@/app/model/useEventEndFrame'
import { OutingMapUnderlay } from '@/pages/management/ui/OutingMapUnderlay'
import { EndingScreen } from '@/pages/ending/ui/EndingScreen'
import type { Collection, HallOfFameResult } from '@/entities/collection/model/collection'
import { nariBatterOf } from '@/app/model/useCollection'
import type { HallOfFameNariPlayer } from '@/pages/special/ui/SpecialScreen'
import { endingBonusOf, isContinuableEnding } from '@/entities/career/model/seasonFlow'
import { TEAMS } from '@/shared/config/original/teams'
import { nationalCupStandingsTitleOf } from '@/entities/career/model/titles'
import { TitleWindow } from '@/widgets/title-window/ui/TitleWindow'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { nariLastGameRecordLineOf } from '@/entities/career/model/playerCareer'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { MatchCommand } from '@/pages/story/model/useEventPlayback'
import { awardWindowTextOf } from '@/pages/story/lib/awardWindows'
import { yearGoalWindowValuesOf } from '@/entities/career/model/seasonFlow'
import { careerLeagueRecordsOf, judgeSeasonAwards } from '@/entities/awards/model/seasonAwards'
import type { StoryCarry } from '@/entities/story/model/aceMatch'
import type { StoryContext } from '@/app/model/useStorySchedule'
import { SceneHourContext, useSceneEntryHour } from '@/shared/lib/phoneClock/phoneClock'

interface CareerRoutesProps {
  readonly screen: Screen
  readonly setScreen: (screen: Screen) => void
  readonly session: ReturnType<typeof useCareerSession>
  readonly runner: AtBatRunner
  readonly random: RandomPort
  /** 커리어가 있는 화면만 이 컴포넌트로 온다 — App이 먼저 걸러준다. */
  readonly career: PlayerCareer
  /** 명예의 전당 등록 목록 (나리 상태 145) — 기록연감·나리 투수편 저장·등록 (G·통계는 App 이 지갑으로 치른다) */
  readonly hallOfFame: {
    readonly collection: Collection
    /** 칸 0 나리 투수 — 투수편 저장이 있으면 (0x5eb8c 의 g+0x43 · 0x1fbd0) */
    readonly nariPitcher: HallOfFameNariPlayer | null
    readonly register: (career: PlayerCareer, slot: number | null) => HallOfFameResult['kind']
    /**
     * 완료 창(꼬리표 0x30)을 닫았을 때 0x1ca4c 가 여는 히든 17(전광판 "고대의전광판") — 열고 알림을 띄웠으면 참이고
     * 그 창을 닫을 때 `then` 을 부른다 (`SpecialScreen` 등록 모드의 같은 이름 머리말)
     */
    readonly openRegisteredHidden?: (then: () => void) => boolean
    /** 전역 G(`mgr+0x64`) — 등록 목록(상태 145) 머리띠 0x54d95 가 그린다 */
    readonly gamePoint?: number
  }
  readonly onAceMatch: AceMatchStarter
  /** 경기 중 메뉴 "설정" 칸이 열 환경설정 — 안 넘기면 그 칸이 잠긴다 */
  readonly gameSettings: ReturnType<typeof useGameSettings>
  /** 마선수 레벨 열 칸 (전역 `mgr[0x13a..0x143]`) — 마선수 대결 경기(`GameRoute`)가 본다 */
  readonly aceLevels?: Readonly<Record<number, number>>
}

export type AceMatchStarter = (command: MatchCommand, carried: StoryCarry, context: StoryContext) => void

/**
 * 경기 장면 0x104 쪽 화면 — 나리 장면 0x106 이 내려가 있다. 여기서 다른 화면으로 오면 장면이 새로 서서 상태 100 진입 0x1c154 를 지난다.
 * ⚠️ 근사: '경기결과' 는 정산 그림(경기 장면 0x19)과 평가 116(나리 장면)을 한 화면으로 보이므로 경기 장면 쪽으로 친다 —
 * 원본은 116 앞 상태 100 에서 시각을 잡으니 몇 초 이르다.
 */
const NARI_OUTSIDE_SCREENS: ReadonlySet<Screen['kind']> = new Set(['경기', '경기결과', '대회경기결과', '마선수대결'])

/**
 * 육성 모드 화면 분기 — 나리 장면의 시간대 시각(상태 100 진입 0x1c154 끝 `0x7b934(gfx, 0xb8fbd())`)을 장면에 들어설 때 잡아
 * 안쪽 화면들(경기장 띠 · 엔딩 띠 · 훈련 창 · 외출 지도 밤)에 내려 준다(`SceneHourContext`).
 */
export function CareerRoutes(props: CareerRoutesProps) {
  const hour = useSceneEntryHour(!NARI_OUTSIDE_SCREENS.has(props.screen.kind))
  return (
    <SceneHourContext.Provider value={hour}>
      <CareerScreens {...props} />
    </SceneHourContext.Provider>
  )
}

function CareerScreens({
  screen,
  setScreen,
  session,
  runner,
  random,
  career,
  hallOfFame,
  onAceMatch,
  gameSettings,
  aceLevels,
}: CareerRoutesProps) {
  const { actions } = session
  const backToManagement = () => setScreen({ kind: '관리' })
  /** 114 재생이 끝난 한 틀 — 대화창 없이 0x19da4 를 그린 뒤 넘긴다 (`useEventEndFrame`) */
  const eventEnd = useEventEndFrame(actions.completeScene)
  /** 이전 화면 — 105 진입 0x11910 이 이전 상태 1 · 114 · 100 이면 가운데 판을 미끄러뜨린다 (0x8a2d8) */
  const screenTrail = useRef<{ readonly kind: Screen['kind']; readonly previous: Screen['kind'] | null }>({ kind: screen.kind, previous: null })
  if (screenTrail.current.kind !== screen.kind) screenTrail.current = { kind: screen.kind, previous: screenTrail.current.kind }
  const previousKind = screenTrail.current.previous
  /**
   * 관리 메뉴 [this+0x8c] 의 커서 — 장면 0x106 이 서 있는 동안 남는다(`NariMainMenuCursor`). 105 에 들어올 때마다(관리 화면,
   * 또는 105 진입 곁가지로 바로 뜬 '관리' 이벤트) 0x11910 의 규칙을 친다: 행동함이고 이전이 109(다음 경기 순위표) · 110(아이템 하위
   * 메뉴)이 아니면 첫 칸. 105 틀에서 뜬 이벤트(이전 화면이 관리)는 새 진입이 아니다. 상점(111 · 121)에서 돌아오면 105 가 아니라 하위
   * 메뉴(110 · 106)로 서므로(`nariReturnSubMenuOf`) 이 규칙을 안 친다 — 110 취소가 그 105 진입을 친다(`useManagementMenu`).
   */
  /**
   * 142 경기 준비 그림 0x15d98 의 0x63b15 넷째 인자 = `[장면+0x28] ≠ 0x8f` — 이전 상태가 143(엔트리 보기)이 아니면
   * 머리띠 미끄러짐 · 배너 연출을 켠다 (`pages/management/lib/matchInfoEntry`).
   */
  const matchView = screen.kind === '경기준비' ? (session.entryView === null ? '142' : '143') : null
  const matchViewTrail = useRef<{ readonly view: string | null; readonly previous: string | null }>({ view: matchView, previous: null })
  if (matchViewTrail.current.view !== matchView) matchViewTrail.current = { view: matchView, previous: matchViewTrail.current.view }
  const isMatchInfoEntryAnimated = matchViewTrail.current.previous !== '143'
  const mainCursor = useRef(createNariMainMenuCursor()).current
  const entryTrail = useRef<string | null>(null)
  const entryKey = screen.kind === '관리' ? '관리'
    : screen.kind === '이벤트' && screen.context === '관리' ? `이벤트:${screen.eventId}` : null
  if (entryKey !== entryTrail.current) {
    const isFromManagementFrame = screen.kind === '이벤트' && entryTrail.current === '관리'
    if (entryKey !== null && !isFromManagementFrame) {
      // 이벤트 → 관리 · 이벤트 → 이벤트는 이전 114 다
      const isFromStandings = entryTrail.current === null && previousKind === '다음경기순위'
      const isSubMenuReturn = entryTrail.current === null && previousKind === '아이템'
      if (!isSubMenuReturn) mainCursor.current = nariMainCursorOnEntry(mainCursor.current, career.hasActedThisCycle, isFromStandings)
    }
    entryTrail.current = entryKey
  }

  const management = (
    <ManagementScreen
      career={career}
      noticeText={session.managementNotice}
      onSelect={actions.runCommand}
      onTraining={actions.runTrainingMenu}
      onTrainingBlocked={actions.showTrainingBlocked}
      isTrainingBlocked={actions.isTrainingBlocked}
      isRestBlocked={actions.isRestBlocked}
      detail={session.managementDetail}
      onCloseDetail={actions.closeManagementDetail}
      onDismissNotice={actions.dismissManagementNotice}
      onOpenShop={actions.openShop}
      onOpenPlayerInfo={actions.openPlayerInfo}
      onEquipTitle={actions.equipTitle}
      onSelectSpecialSwing={actions.selectSpecialSwing}
      onEquipSkill={actions.equipSkill}
      onExpandSkillSlots={actions.expandSkillSlots}
      // 105 취소 0x1261c 126e6~126fa: 0x375d · [0x140006c] = 5 · 장면 0x103 — 메인 메뉴를 게임시작 목록으로 바로 연다
      onExit={() => setScreen({ kind: '메인메뉴', openTier: 5 })}
      onReenter={actions.reenterManagement}
      onMainConfirm={actions.pressManagementConfirm}
      // 114(이벤트) · 100(경기 뒤 재진입 — 경기결과) · 1(자원 적재 — 처음 선다)
      centerSlidesIn={previousKind === null || previousKind === '이벤트' || previousKind === '경기결과'}
      mainCursor={mainCursor}
    />
  )

  /**
   * 칭호 팝업 0x1274c (종류 0x78, 그리기 0x1afe8 · 키 0x1b1e4 — `TitleWindow`) — 관리 화면 위에 하나씩. 다른 알림·상세 창이 닫힌 뒤에 띄운다.
   * 키가 비트·장착·저장(`confirmTitle`)과 함께 창을 그 자리에서 치우고([창+9] = 0, 닫힘 애니 없음), 다음 갱신 0x1aec4 가
   * +0x274 == 1 이라 다시 판정해 다음 칭호를 새 창(높이 6 에서 펼침)으로 띄운다 — `key` 가 칭호마다 새 창을 세운다.
   */
  const titlePopup = session.pendingTitle !== null && session.managementNotice === '' && session.managementDetail === null
    ? <TitleWindow key={session.pendingTitle} title={session.pendingTitle} onKey={actions.confirmTitle} />
    : null
  const managementWithTitle = (
    <>
      {management}
      {titlePopup}
    </>
  )

  switch (screen.kind) {
    case '경기':
      if (session.progress === null) return management
      return (
        <GameRoute
          session={session}
          progress={session.progress}
          runner={runner}
          random={random}
          career={career}
          gameSettings={gameSettings}
          aceLevels={aceLevels}
        />
      )

    case '경기결과':
      return (
        <GameResultScreen
          summary={screen.summary}
          gamePointReward={screen.gamePointReward}
          newTitles={screen.newTitles}
          onConfirmTitle={actions.confirmGameResultTitle}
          evaluation={screen.evaluation}
          streakNotices={screen.streakNotices}
          // 116 의 S+0x1d8 — 정산이 남긴 줄(포스트시즌 경기 뒤에는 앞 평가 경기 줄)
          {...(career.lastGame === undefined ? {} : { recordLine: nariLastGameRecordLineOf(career.lastGame) })}
          career={career}
          onContinue={actions.confirmGameResult}
          // 116(0x11e0c) → 114 평가 대화 0x8b5ac: 공 무늬 · 상태판([이벤트+0xb] = 1 — 0x8a71e) · 머리띠
          underlay={<NariEventUnderlay career={career} isPreviousGame />}
          // 정산 0x4ea0c 를 막 지났을 때만 — 결과 그림 0x4a384 의 배경 · 정산 효과(경기 난수)
          {...(screen.settlementInning === undefined
            ? {}
            : {
              settlement: {
                inning: screen.settlementInning,
                playerSide: screen.settlementPlayerSide ?? 1,
                random,
                // 경기 중 구장 하늘 줄 그대로 (0x783b0 — 경기를 세울 때 한 번)
                ...(screen.settlementSkyRow === undefined ? {} : { skyRow: screen.settlementSkyRow }),
                // 구장 객체도 방금 끝난 경기 장면의 것 그대로 (다음 경기를 세울 때까지 세션이 든다)
                stadium: session.sceneStadium,
              },
            })}
        />
      )

    // 국가대항전 경기 결과 — 정규 경기와 같은 결과 판(0x18 · 0x4a384), 116 평가 없이 [확인] → 134 대진판
    case '대회경기결과':
      return (
        <GameResultScreen
          summary={screen.summary}
          gamePointReward={screen.gamePointReward}
          newTitles={[]}
          career={career}
          onContinue={actions.confirmCupGameResult}
          // 대회 경기도 정산 0x4ea0c 꼬리를 지난다 — 결과 그림 0x4a384 의 배경 · 정산 효과(경기 난수)
          settlement={{
            inning: screen.settlementInning, playerSide: screen.settlementPlayerSide, random, skyRow: screen.settlementSkyRow,
            stadium: session.sceneStadium,
          }}
        />
      )

    case '외출':
      return (
        <OutingMapScreen
          noticeText={session.outingNotice}
          onRun={actions.runOutingFunction}
          onBack={backToManagement}
          // [!] 칸 [gfx+0x9c] — 112 진입 0x118e4 에 찍은 값 그대로(0x7ed6c 는 행동 여부를 안 본다)
          eventPlaceIds={session.eventPlaceIds}
          onEnter={actions.enterPlace}
          // 126 효과 팝업 → [확인] → 105 (입원 회복 글은 관리 화면 알림으로)
          resultText={session.outingResult?.effectText ?? null}
          onCloseResult={actions.closeOutingResult}
          presentation={session.outingPresentation === null ? null : (
            <SeasonOutingPopup place={session.outingPresentation.place}
              presentation={nariOutingPresentationOf(session.outingPresentation.place, { isSlugger: career.battingTypeIndex === 1 })}
              char0Palette={portraitPaletteIndex(career.skinIndex)}
              onFinished={actions.finishOutingPresentation} />
          )}
        />
      )

    case '아이템':
      return (
        <ShopScreen
          key={screen.tab}
          initialTab={screen.tab}
          career={career}
          noticeText={session.shopNotice}
          gpDetail={session.shopGpDetail}
          onCloseGpDetail={actions.closeShopGpDetail}
          onPurchase={actions.purchase}
          // 111 취소 → 110 · 121(장비착용) 취소 → 106 — 관리 화면이 다시 열릴 때 그 하위 메뉴 그 칸에 선다(`nariReturnSubMenuOf`)
          onBack={backToManagement}
        />
      )

    case '이벤트': {
      const event = session.storyEvents?.find((candidate) => candidate.id === screen.eventId)
      if (session.storyEvents === null || event === undefined) return management
      // 114 그림 0x19e64 → 대화창 0x8b5ac: [gfx+0x174](0x7e84c 가 받은 마지막 상태)가 0x70·0x71 이면 외출 지도,
      // 그 밖(105 · 115 · 116 · 117 · 130~138 뒤)은 공 무늬 + 상태판(둘째 인자 [이벤트+0xb]) + 머리띠 (`NariEventUnderlay`).
      // 웹이 트는 이벤트는 파일 이벤트라 [이벤트+0xb] 는 0 이다(경기 뒤 평가 내장 이벤트는 경기결과 화면이 맡는다).
      // 외출진입(112) · 장소(113) · 대결결과(140 — 진입 0x10df8 이 0x7e84c(gfx, 0x70))는 지도 0x7ea64(gfx, −1, 0) 만 (`OutingMapUnderlay`).
      // 같은 [gfx+0x174] 가 초상화 바닥 y 도 고른다(0x7fdee — 지도 252 · 그 밖 135).
      const isOverOutingMap = screen.context === '외출진입' || screen.context === '장소' || screen.context === '대결결과'
      // 재생이 끝난 한 틀(`useEventEndFrame`) — 0x19e64 는 앞 상태 [this+0x28] 가 112 · 113 일 때만 지도다. 140(대결결과)은 앞 상태가
      // 0x8c 라 지도가 아니라 0x19da4 를 그린다(재생 중 지도는 [gfx+0x174] = 0x70 탓). 커맨드 줄 칸은 앞 상태가 105 일 때만
      // (0x7e84c(0x69) 의 관리 6칸 — '관리' 갈래, 138 을 거친 타순 이벤트는 빼고), 그 밖은 칸 수 0 이라 안 그린다
      if (eventEnd.isEnding) {
        if (screen.context === '외출진입' || screen.context === '장소') {
          return <OutingMapUnderlay eventPlaceIds={session.eventPlaceIds} />
        }
        return (
          <NariEventUnderlay career={career}>
            {screen.context === '관리' && !isBattingOrderEventId(screen.eventId) && <NariMainCommandBar menuEnable={career} cursor={mainCursor.current} />}
          </NariEventUnderlay>
        )
      }
      return (
        <>
          {(screen.context === '관리' || screen.context === '연초' || screen.context === '시즌') && <NariEventUnderlay career={career} />}
          {isOverOutingMap && (
            <OutingMapUnderlay eventPlaceIds={session.eventPlaceIds} />
          )}
          {/* 대사창은 화면 **위에 얹히는 덮개**다 — 안 감싸면 창 전체로 퍼져 구석에 그려진다 */}
          <ScreenOverlay>
          <StoryScreen
            // 명령 5 의 500ms 진동(0x3a44)은 환경설정 진동(옵션 +0x3b)이 켜졌을 때만
            isVibrationOn={gameSettings.settings.isVibrationOn}
            isOverOutingMap={isOverOutingMap}
            key={event.id}
            events={session.storyEvents}
            event={event}
            playerName={career.name}
            teamName={(TEAMS[career.teamId] ?? TEAMS[0]).name}
            skinIndex={career.skinIndex}
            battingTypeIndex={career.battingTypeIndex}
            onComplete={eventEnd.end}
            carried={screen.carried}
            onMatch={(command, carried) => onAceMatch(command, carried, screen.context)}
            // 370·375 의 system 3·4 — 타이틀(0x8b3bc)·MVP(0x8b23c) 발표 창. 130·131 과 같은 판정(0x8dad4 타자 · 0x8dd60)이다
            systemWindowTextOf={(command) =>
              awardWindowTextOf(command.sub, () => judgeSeasonAwards(career, careerLeagueRecordsOf(career), '타자'))
            }
            // system 1 올해의 목표 창 — 연초 115 · 392 (0x8d304 → 0x86fdc)
            yearGoalWindowOf={() => yearGoalWindowValuesOf(career)}
            // 보상 명령 7 의 알림 창 — 0x8beb8 글 → 0x74ef4 종류 1 · 첫 종류 4 는 스킬 창 0x741a0 (모드 4 타자편)
            rewardNoticeContext={() => rewardNoticeContextOf(career, BATTER_LEAGUE_MODE, random)}
            // system 창 답 0 → 0x7fe90 (S+0x1b7 = 1 · 저장)
            onSystemWindowConfirm={actions.confirmEventSystemWindow}
            // 보상 명령 7 은 창을 세운 그 갱신에 준다 (0x8c460)
            onReward={actions.giveEventReward}
            // 선택지 OK → 0x8b0e4 (떠나온 줄 본 표시 · 저장)
            onChoiceConfirm={actions.confirmEventChoice}
          />
          </ScreenOverlay>
        </>
      )
    }

    case '성적':
      return <RecordScreen career={career} onBack={backToManagement} />

    case '다음경기순위':
      return (
        <NextGameStandingsScreen league={career.league} edition="타자편" gamePoint={career.gamePoint}
          isFromManagement={screen.fromManagement}
          onConfirm={actions.confirmNextGameStandings} onCancel={actions.cancelNextGameStandings} />
      )

    case '경기준비': {
      // 142 ↔ 143 은 화면 밀기(효과기 종류 8, 0xbdae9(…, 8, 0, 3/4, 1000))로 바뀐다 (`NariScreenPush`)
      const entryView = session.entryView
      const pushView = entryView === null ? '142' : entryView.isMyTeam ? '143:내팀' : '143:상대'
      // 143 경기 전 엔트리 보기 — 진입 0x16af8 · 키 0x1457c · 그림 0x16738 (보기 전용, 끝 코드로 142 로 돌아간다)
      if (entryView !== null) {
        return (
          <NariScreenPush view={pushView}>
            <EntryEditorScreen editor={entryView.editor} lists={entryView.lists}
              teamName={TEAMS[entryView.teamId]?.name ?? ''} isAceLocked={false} gamePoint={career.gamePoint}
              onKey={actions.pressEntryViewKey} onMoveCursor={actions.pointEntryViewCursor} onCloseAceLocked={() => {}}
              // 나리 틀 0x16928 은 142~144 면 142 진입이 떠 둔 구장 바탕(0x581dc)을 깐다
              underlay={<MatchInfoStadiumBackdrop stage={session.matchInfoStage} />} slides={false} />
          </NariScreenPush>
        )
      }
      // 142 경기 준비 — 진입 0x1c46c · 키 0x13c30 · 그림 0x15d98
      // 국가대항전(135 에서 옴)이면 대회 표 · 마선수 "-" (1c5fe)
      const match = screen.cup === undefined
        ? batterMatchInfoOf(career, session.matchAces)
        : cupMatchInfoOf(career, screen.cup.matchup, screen.cup.cup)
      return (
        <NariScreenPush view={pushView}>
          <NariMatchInfoScreen lines={match.lines} myTeamId={match.myTeamId} opponentTeamId={match.opponentTeamId}
            playerSide={match.playerSide} edition="타자편" gamePoint={career.gamePoint} stage={session.matchInfoStage}
            onStart={actions.confirmMatchPrepare} onCancel={actions.cancelMatchPrepare} onEntry={actions.openEntryView}
            isEntryAnimated={isMatchInfoEntryAnimated} />
        </NariScreenPush>
      )
    }

    case '시즌종료':
      return <SeasonEndScreen career={career} onStartNextSeason={actions.beginYearEnd} />

    case '포스트시즌':
      return (
        <PostseasonScreen
          series={career.postseason}
          edition="타자편"
          gamePoint={career.gamePoint}
          popup={screen.popup}
          onConfirm={actions.pressPostseason}
          onClosePopup={actions.closePostseasonPopup}
        />
      )

    case '국가대항전':
      return (
        <NationalCupScreen
          mode="나만의리그"
          cup={screen.cup}
          // 제 n 회 = (연차 idx >> 1) + 1 (`0x85e6c`). 대회는 **끝난 해**의 연말에 치르고
          // 새 시즌은 대회가 끝난 뒤에야 오르므로(`0x1b768`), 연차 idx 는 지금 시즌 − 1 이다
          yearIndex={career.season - 1}
          gamePoint={career.gamePoint}
          random={random}
          onStartGame={actions.startCupGame}
          onFinish={actions.finishCup}
          // 142 취소로 돌아오면 135(순위표)부터
          initialStep={screen.atStandings === true ? '순위' : '대진'}
          // 134 진입 0x19f30 — 처음 열리는 히든 팀(대한민국 · 우승이면 결승 상대)마다 StrCOMMON[138] 팝업 0x22 · 전역 해금
          openedHiddenIds={career.openedHiddenIds}
          onOpenHiddenTeams={actions.syncOpenedHidden}
          // 134 첫 틀 0x1b92c 머리 — 비트 8 이 없으면 칭호 8 "국가 대표" 팝업 0x78, 확인 0x1b1e4 가 주고 장착
          entryTitle={nationalCupStandingsTitleOf(career.titleIds)}
          onConfirmEntryTitle={actions.confirmCupTitle}
        />
      )

    case '엔딩':
      return (
        <EndingScreen playerName={career.name} endingIndex={screen.endingIndex} seenEventIds={career.seenEventIds}
          // 선수 생김새 +0xb — 타입(bit5~7)·손(bit4)·피부(bit2~3). 걸어 들어오는 그림·제작진 선수 애니와 팔레트 (0x63a5c)
          walkInLook={{ mode: 4, typeIndex: career.battingTypeIndex, handIndex: career.battingSide, skinIndex: career.skinIndex }}
          bonusGamePoint={endingBonusOf(screen.endingIndex)} isContinuable={isContinuableEnding(screen.endingIndex)}
          // S+0x7b — 141 로 이어하기한 엔딩은 보너스를 이미 받았다. 팝업 0x2b 를 닫을 때 보너스 · S+0x7b · 저장 (1bbf4~1bc70)
          isBonusReceived={career.endingBonusReceived === true} onBonusReceived={actions.receiveEndingBonus}
          hallOfFame={{
            collection: hallOfFame.collection,
            edition: '타자',
            nari: {
              투수: hallOfFame.nariPitcher,
              타자: nariBatterOf(career),
            },
            // 등록이 된 그 순간 0x62dbe 가 모드 저장을 지운다(0x224ec) — 완료 창을 닫기 전이다
            onRegister: (slot) => {
              const result = hallOfFame.register(career, slot)
              if (result === '등록') actions.eraseSaveForHallOfFame()
              return result
            },
            ...(hallOfFame.gamePoint === undefined ? {} : { gamePoint: hallOfFame.gamePoint }),
            ...(hallOfFame.openRegisteredHidden === undefined ? {} : { openRegisteredHidden: hallOfFame.openRegisteredHidden }),
          }}
          onContinue={actions.continueAfterEnding}
          onFinish={actions.finishEnding} />
      )

    default:
      return screen.kind === '관리' ? managementWithTitle : management
  }
}
