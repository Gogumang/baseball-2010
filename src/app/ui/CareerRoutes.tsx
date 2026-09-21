import type { Screen } from '@/app/model/screen'
import type { AtBatRunner } from '@/app/model/useAtBatRunner'
import type { useCareerSession } from '@/app/model/useCareerSession'
import { GameRoute } from '@/app/ui/GameRoute'
import type { useGameSettings } from '@/app/model/useGameSettings'
import { GameResultScreen } from '@/pages/game-result/ui/GameResultScreen'
import { ManagementScreen } from '@/pages/management/ui/ManagementScreen'
import { ShopScreen } from '@/pages/shop/ui/ShopScreen'
import { OutingMapScreen } from '@/pages/outing-map/ui/OutingMapScreen'
import { ScreenOverlay } from '@/shared/ui'
import { StoryScreen } from '@/pages/story/ui/StoryScreen'
import { RecordScreen } from '@/pages/record/ui/RecordScreen'
import { SeasonEndScreen } from '@/pages/season-end/ui/SeasonEndScreen'
import { NationalCupScreen } from '@/pages/national-cup/ui/NationalCupScreen'
import { EndingScreen } from '@/pages/ending/ui/EndingScreen'
import type { HallOfFameResult } from '@/entities/collection/model/collection'
import { endingBonusOf, isContinuableEnding } from '@/entities/career/model/seasonFlow'
import { TEAMS } from '@/shared/config/original/teams'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { MatchCommand } from '@/pages/story/model/useEventPlayback'
import type { StoryCarry } from '@/entities/story/model/aceMatch'
import type { StoryContext } from '@/app/model/useStorySchedule'

interface CareerRoutesProps {
  readonly screen: Screen
  readonly setScreen: (screen: Screen) => void
  readonly session: ReturnType<typeof useCareerSession>
  readonly runner: AtBatRunner
  readonly random: RandomPort
  /** 커리어가 있는 화면만 이 컴포넌트로 온다 — App이 먼저 걸러준다. */
  readonly career: PlayerCareer
  readonly onRegisterHallOfFame: (career: PlayerCareer) => HallOfFameResult['kind']
  readonly onAceMatch: AceMatchStarter
  /** 경기 중 메뉴 "설정" 칸이 열 환경설정 — 안 넘기면 그 칸이 잠긴다 */
  readonly gameSettings: ReturnType<typeof useGameSettings>
}

export type AceMatchStarter = (command: MatchCommand, carried: StoryCarry, context: StoryContext) => void

/** 육성 모드 화면 분기. */
export function CareerRoutes({
  screen,
  setScreen,
  session,
  runner,
  random,
  career,
  onRegisterHallOfFame,
  onAceMatch,
  gameSettings,
}: CareerRoutesProps) {
  const { actions } = session
  const backToManagement = () => setScreen({ kind: '관리' })

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
      onExit={() => setScreen({ kind: '메인메뉴' })}
    />
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
        />
      )

    case '경기결과':
      return (
        <GameResultScreen
          summary={screen.summary}
          gamePointReward={screen.gamePointReward}
          newTitles={screen.newTitles}
          evaluation={screen.evaluation}
          streakNotices={screen.streakNotices}
          career={career}
          onContinue={actions.confirmGameResult}
        />
      )

    case '외출':
      return (
        <OutingMapScreen
          career={career}
          noticeText={session.outingNotice}
          onRun={actions.runOutingFunction}
          onBack={backToManagement}
          // 이벤트도 외출 행동이라 이번 주기에 이미 무언가 했으면 [!] 가 없다
          eventPlaceIds={career.hasActedThisCycle ? new Set() : session.eventPlaceIds}
          onEnter={actions.enterPlace}
        />
      )

    case '아이템':
      return (
        <ShopScreen
          key={screen.tab}
          initialTab={screen.tab}
          career={career}
          noticeText={session.shopNotice}
          onPurchase={actions.purchase}
          onBack={backToManagement}
        />
      )

    case '이벤트': {
      const event = session.storyEvents?.find((candidate) => candidate.id === screen.eventId)
      if (session.storyEvents === null || event === undefined) return management
      // 원본은 이벤트를 따로 된 화면으로 띄우지 않는다. `trigger` 가 **어느 화면 위에 뜨는지**를 가리킨다
      // (0 관리 화면 · 1 외출 지도 · 2~6 장소). 관리 화면(trigger 0)만 확인돼서 그것부터 깔아 둔다 —
      // 외출·장소 이벤트의 뒷 화면은 아직 확인하지 못해 예전처럼 덮개만 띄운다.
      return (
        <>
          {screen.context === '관리' && management}
          {/* 대사창은 화면 **위에 얹히는 덮개**다 — 안 감싸면 창 전체로 퍼져 구석에 그려진다 */}
          <ScreenOverlay>
          <StoryScreen
            key={event.id}
            events={session.storyEvents}
            event={event}
            playerName={career.name}
            teamName={(TEAMS[career.teamId] ?? TEAMS[0]).name}
            skinIndex={career.skinIndex}
            battingTypeIndex={career.battingTypeIndex}
            onComplete={actions.completeScene}
            carried={screen.carried}
            onMatch={(command, carried) => onAceMatch(command, carried, screen.context)}
          />
          </ScreenOverlay>
        </>
      )
    }

    case '성적':
      return <RecordScreen career={career} onBack={backToManagement} />

    case '시즌종료':
      return <SeasonEndScreen career={career} onStartNextSeason={actions.beginYearEnd} />

    case '국가대항전':
      return (
        <NationalCupScreen
          mode="나만의리그"
          cup={screen.cup}
          // 제 n 회 = (연차 idx >> 1) + 1 (`0x85e6c`). 대회는 **끝난 해**의 연말에 치르고
          // 새 시즌은 대회가 끝난 뒤에야 오르므로(`0x1b768`), 연차 idx 는 지금 시즌 − 1 이다
          yearIndex={career.season - 1}
          random={random}
          onStartGame={actions.startCupGame}
          onFinish={actions.finishCup}
        />
      )

    case '엔딩':
      return (
        <EndingScreen playerName={career.name} endingIndex={screen.endingIndex}
          bonusGamePoint={endingBonusOf(screen.endingIndex)} isContinuable={isContinuableEnding(screen.endingIndex)}
          onRegister={() => onRegisterHallOfFame(career)} onContinue={actions.continueAfterEnding}
          onFinish={actions.finishEnding} />
      )

    default:
      return management
  }
}
