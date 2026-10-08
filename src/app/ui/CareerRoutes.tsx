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
import { batterMatchInfoOf, cupMatchInfoOf } from '@/pages/management/lib/nariMatchPrepare'
import { ShopScreen } from '@/pages/shop/ui/ShopScreen'
import { OutingMapScreen } from '@/pages/outing-map/ui/OutingMapScreen'
import { MessageBox, ScreenOverlay } from '@/shared/ui'
import { StoryScreen } from '@/pages/story/ui/StoryScreen'
import { rewardNoticeContextOf } from '@/entities/story/model/rewardNotice'
import { BATTER_LEAGUE_MODE } from '@/entities/collection/model/annalsStats'
import { RecordScreen } from '@/pages/record/ui/RecordScreen'
import { SeasonEndScreen } from '@/pages/season-end/ui/SeasonEndScreen'
import { PostseasonScreen } from '@/pages/season-end/ui/PostseasonScreen'
import { NationalCupScreen } from '@/pages/national-cup/ui/NationalCupScreen'
import { NariScreenPush } from '@/pages/management/ui/NariScreenPush'
import { NariEventUnderlay } from '@/pages/management/ui/NariEventUnderlay'
import { OutingMapUnderlay } from '@/pages/management/ui/OutingMapUnderlay'
import { EndingScreen } from '@/pages/ending/ui/EndingScreen'
import type { Collection, HallOfFameResult } from '@/entities/collection/model/collection'
import { nariBatterOf } from '@/app/model/useCollection'
import type { HallOfFameNariPlayer } from '@/pages/special/ui/SpecialScreen'
import { endingBonusOf, isContinuableEnding } from '@/entities/career/model/seasonFlow'
import { TEAMS } from '@/shared/config/original/teams'
import { conditionTextOf } from '@/entities/career/model/titles'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { nariLastGameRecordLineOf } from '@/entities/career/model/playerCareer'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { MatchCommand } from '@/pages/story/model/useEventPlayback'
import { awardWindowTextOf } from '@/pages/story/lib/awardWindows'
import { yearGoalWindowValuesOf } from '@/entities/career/model/seasonFlow'
import { careerLeagueRecordsOf, judgeSeasonAwards } from '@/entities/awards/model/seasonAwards'
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
  /** 명예의 전당 등록 목록 (나리 상태 145) — 기록연감·나리 투수편 저장·등록 (G·통계는 App 이 지갑으로 치른다) */
  readonly hallOfFame: {
    readonly collection: Collection
    /** 칸 0 나리 투수 — 투수편 저장이 있으면 (0x5eb8c 의 g+0x43 · 0x1fbd0) */
    readonly nariPitcher: HallOfFameNariPlayer | null
    readonly register: (career: PlayerCareer, slot: number | null) => HallOfFameResult['kind']
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

/** 육성 모드 화면 분기. */
export function CareerRoutes({
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
  /** 이전 화면 — 105 진입 0x11910 이 이전 상태 1 · 114 · 100 이면 가운데 판을 미끄러뜨린다 (0x8a2d8) */
  const screenTrail = useRef<{ readonly kind: Screen['kind']; readonly previous: Screen['kind'] | null }>({ kind: screen.kind, previous: null })
  if (screenTrail.current.kind !== screen.kind) screenTrail.current = { kind: screen.kind, previous: screenTrail.current.kind }
  const previousKind = screenTrail.current.previous

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
      onExit={() => setScreen({ kind: '메인메뉴' })}
      // 114(이벤트) · 100(경기 뒤 재진입 — 경기결과) · 1(자원 적재 — 처음 선다)
      centerSlidesIn={previousKind === null || previousKind === '이벤트' || previousKind === '경기결과'}
    />
  )

  /**
   * 칭호 팝업 0x1274c (종류 0x78) — 관리 화면 위에 하나씩. 그림 0x1afe8 은 이름 StrNICKNAME[i] 와 조건 문구 [i+64] 를 그린다.
   * ⚠️ 그 팝업 틀의 배치(0x1afe8 의 좌표·그림)는 옮기지 않아 알림 상자로 보인다 — 근사. 다른 알림·상세 창이 닫힌 뒤에 띄운다.
   */
  const titlePopup = session.pendingTitle !== null && session.managementNotice === '' && session.managementDetail === null
    ? (
      <MessageBox
        text={`!C${session.pendingTitle}!N${conditionTextOf(session.pendingTitle) ?? ''}`}
        buttons={['확인']}
        onAnswer={actions.confirmTitle}
      />
    )
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
            : { settlement: { inning: screen.settlementInning, playerSide: screen.settlementPlayerSide ?? 1, random } })}
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
          settlement={{ inning: screen.settlementInning, playerSide: screen.settlementPlayerSide, random }}
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
      return (
        <>
          {(screen.context === '관리' || screen.context === '연초' || screen.context === '시즌') && <NariEventUnderlay career={career} />}
          {isOverOutingMap && (
            <OutingMapUnderlay eventPlaceIds={session.eventPlaceIds} hour={new Date().getHours()} />
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
            onComplete={actions.completeScene}
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
              onKey={actions.pressEntryViewKey} onMoveCursor={actions.pointEntryViewCursor} onCloseAceLocked={() => {}} />
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
            playerSide={match.playerSide} edition="타자편" gamePoint={career.gamePoint}
            onStart={actions.confirmMatchPrepare} onCancel={actions.cancelMatchPrepare} onEntry={actions.openEntryView} />
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
        />
      )

    case '엔딩':
      return (
        <EndingScreen playerName={career.name} endingIndex={screen.endingIndex} seenEventIds={career.seenEventIds}
          // 선수 생김새 +0xb — 타입(bit5~7)·손(bit4)·피부(bit2~3). 걸어 들어오는 그림·제작진 선수 애니와 팔레트 (0x63a5c)
          walkInLook={{ mode: 4, typeIndex: career.battingTypeIndex, handIndex: career.battingSide, skinIndex: career.skinIndex }}
          bonusGamePoint={endingBonusOf(screen.endingIndex)} isContinuable={isContinuableEnding(screen.endingIndex)}
          hallOfFame={{
            collection: hallOfFame.collection,
            edition: '타자',
            nari: {
              투수: hallOfFame.nariPitcher,
              타자: nariBatterOf(career),
            },
            onRegister: (slot) => hallOfFame.register(career, slot),
            ...(hallOfFame.gamePoint === undefined ? {} : { gamePoint: hallOfFame.gamePoint }),
          }}
          onContinue={actions.continueAfterEnding}
          onFinish={actions.finishEnding} />
      )

    default:
      return screen.kind === '관리' ? managementWithTitle : management
  }
}
