import { PitcherCreateFlow } from '@/pages/pitcher-league/ui/PitcherCreateFlow'
import { useRef } from 'react'
import { PitcherManagementScreen } from '@/pages/pitcher-league/ui/PitcherManagementScreen'
import { PitcherEventUnderlay } from '@/pages/pitcher-league/ui/PitcherEventUnderlay'
import { OutingMapUnderlay } from '@/pages/management/ui/OutingMapUnderlay'
import { NextGameStandingsScreen } from '@/pages/management/ui/NextGameStandingsScreen'
import { NariMatchInfoScreen } from '@/pages/management/ui/NariMatchInfoScreen'
import { EntryEditorScreen } from '@/widgets/entry-editor'
import { pitcherCupMatchInfoOf, pitcherMatchInfoOf } from '@/pages/pitcher-league/lib/pitcherMatchInfo'
import { NationalCupScreen } from '@/pages/national-cup/ui/NationalCupScreen'
import { NariScreenPush } from '@/pages/management/ui/NariScreenPush'
import { PitcherSeasonEndScreen } from '@/pages/pitcher-league/ui/PitcherSeasonEndScreen'
import { PitcherYearEndScreen } from '@/pages/pitcher-league/ui/PitcherYearEndScreen'
import { PitcherGameEvaluationScreen } from '@/pages/pitcher-league/ui/PitcherGameEvaluationScreen'
import { PitcherGameScreen } from '@/pages/pitching/ui/PitcherGameScreen'
import { PitcherShopScreen } from '@/pages/shop/ui/PitcherShopScreen'
import { EndingScreen } from '@/pages/ending/ui/EndingScreen'
import { OutingMapScreen } from '@/pages/outing-map/ui/OutingMapScreen'
import { StoryScreen } from '@/pages/story/ui/StoryScreen'
import { rewardNoticeContextOf } from '@/entities/story/model/rewardNotice'
import { PITCHER_LEAGUE_MODE } from '@/entities/collection/model/annalsStats'
import { awardWindowTextOf } from '@/pages/story/lib/awardWindows'
import { pitcherYearGoalWindowValuesOf } from '@/entities/pitcher-career/model/pitcherYearGoals'
import { PostseasonScreen } from '@/pages/season-end/ui/PostseasonScreen'
import { MessageBox, ScreenOverlay } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import { conditionTextOf } from '@/entities/career/model/titles'
import {
  isContinuablePitcherEnding,
  judgePitcherSeasonAwards,
  pitcherEndingBonusOf,
} from '@/entities/pitcher-career/model/pitcherSeasonFlow'
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

interface PitcherLeagueRouteProps {
  readonly session: PitcherLeagueSession
  readonly random: RandomPort
  readonly openedHiddenIds?: readonly number[]
  /** 경기 중 메뉴 "설정" 칸 */
  readonly gameSettings: ReturnType<typeof useGameSettings>
  readonly onExit: () => void
  /** 명예의 전당 등록 목록 (나리 상태 145, 모드 3) — 기록연감·칸 5 나리 타자·등록 (G·통계는 App 이 지갑으로 치른다) */
  readonly hallOfFame?: {
    readonly collection: Collection
    readonly nariBatter: HallOfFameNariPlayer | null
    readonly register: (career: PitcherCareer, slot: number | null) => HallOfFameResult['kind']
    /** 전역 G(`mgr+0x64`) — 등록 목록(상태 145) 머리띠 0x54d95 가 그린다 */
    readonly gamePoint?: number
  }
  /**
   * 마선수 대결 화면 — 투수 미션 레코드(team − 1)를 사람이 던지는 미션 장면(모드 5). 끝나면 `onFinish(이겼나)`.
   * 안 넘기면 대결을 열지 않고 예전처럼 지나온 보상만 남기고 105 로 돌아간다 (`abortStoryAtMatch`).
   */
  readonly renderAceMatch?: (match: PitcherAceMatch, onFinish: (isWin: boolean) => void) => ReactNode
}

/**
 * 나만의리그 **투수편** 라우팅 (원본 게임 모드 3, 장면 0x106).
 *
 * 등록(0x65 → 0x66) → 관리(상태 105 허브) → 경기 → 정산 한 바퀴를 돌다가,
 * 45경기를 다 치르면 **시즌종료(136 자리) → 130·131 → 포스트시즌 대진(128) → 연말(132) → 엔딩(141)** 로 빠진다.
 * 관리 화면 안의 선수정보·트레이닝·구질 훈련·휴식은 `PitcherManagementScreen` 이 스스로 돈다.
 *
 * [외출] → **112 외출 지도** 는 타자편 화면(`OutingMapScreen`)을 그대로 쓴다 — 원본 모드 3·4 가 같은 상태·
 * 같은 코드(지도 0x7ea64 · 장소 0x16c64 · 효과 0x15234 · [!] 배정 0x8cdc0)를 돈다.
 * **114 이벤트 재생**은 타자편 `StoryScreen` 을 그대로 쓴다 — 원본도 모드 3·4 가 같은 재생기(0x8be20 · 0x8b804)다.
 * 주인공 초상화는 피부 팔레트만 따른다: 장타형 +8(0x63a70)은 `모드 == 4` 일 때만이라 투수는 늘 +0 이다.
 * 상점은 [아이템] → 110 → **111 상점**(장비·서브·GP) · [선수정보] → **121 장비착용** 이 `PitcherShopScreen` 으로 간다.
 */
export function PitcherLeagueRoute({
  session, random, openedHiddenIds = [], gameSettings, onExit, renderAceMatch, hallOfFame,
}: PitcherLeagueRouteProps) {
  const { career, scene, gameOptions, shopTab, shopNotice, shopGpDetail, actions } = session
  /** 이전 장면 — 105 진입 0x11910 이 이전 상태 1 · 114 · 100 이면 가운데 판을 미끄러뜨린다 (0x8a2d8) */
  const sceneTrail = useRef<{ readonly scene: string; readonly previous: string | null }>({ scene, previous: null })
  if (sceneTrail.current.scene !== scene) sceneTrail.current = { scene, previous: sceneTrail.current.scene }
  const previousScene = sceneTrail.current.previous

  if (career === null || scene === '등록') {
    return <PitcherCreateFlow openedHiddenIds={openedHiddenIds} onCreate={actions.create} onCancel={onExit} />
  }

  if (scene === '경기' && gameOptions !== null) {
    return (
      <PitcherGameScreen
        options={gameOptions}
        pitcherName={career.name}
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
    return <PitcherGameEvaluationScreen career={career} lastGame={career.lastGame} onConfirm={actions.confirmGameResult} />
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
      onExit={onExit}
      // 114(이벤트) · 100(경기 뒤 — 경기결과) · 1(처음 선다)
      centerSlidesIn={previousScene === null || previousScene === '이벤트' || previousScene === '경기결과'}
    />
  )

  if (scene === '다음경기순위') {
    return (
      <NextGameStandingsScreen league={career.league} edition="투수편" gamePoint={career.gamePoint}
        isFromManagement={session.nextGameFromManagement}
        onConfirm={actions.confirmNextGameStandings} onCancel={actions.cancelNextGameStandings} />
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
          <EntryEditorScreen editor={entryView.editor} lists={entryView.lists}
            teamName={TEAMS[entryView.teamId]?.name ?? ''} isAceLocked={false} gamePoint={career.gamePoint}
            onKey={actions.pressEntryViewKey} onMoveCursor={actions.pointEntryViewCursor} onCloseAceLocked={() => {}} />
        </NariScreenPush>
      )
    }
    // 142 경기 준비 — 진입 0x1c46c · 키 0x13c30 · 그림 0x15d98 (타자편과 같은 상태)
    // 국가대항전(135 에서 옴)이면 대회 표 · 마선수 "-" (1c5fe)
    const match = session.cupMatch === null
      ? pitcherMatchInfoOf(career, session.matchAces)
      : pitcherCupMatchInfoOf(career, session.cupMatch.matchup, session.cupMatch.cup)
    return (
      <NariScreenPush view={pushView}>
        <NariMatchInfoScreen lines={match.lines} myTeamId={match.myTeamId} opponentTeamId={match.opponentTeamId}
          playerSide={match.playerSide} edition="투수편" gamePoint={career.gamePoint}
          onStart={actions.confirmMatchPrepare} onCancel={actions.cancelMatchPrepare} onEntry={actions.openEntryView} />
      </NariScreenPush>
    )
  }

  const outingMap = (
    <OutingMapScreen
      noticeText={session.outingNotice}
      onRun={actions.runOutingFunction}
      // 112 취소 → 105 (키 0x13ba4)
      onBack={() => actions.goto('관리')}
      // 장소 이벤트 배정 0x8cdc0 — 장소마다 파일 순서 첫 이벤트(대상 1·3)
      eventPlaceIds={session.eventPlaceIds}
      onEnter={actions.enterOutingPlace}
      // 126 효과 팝업 → [확인] → 105 (입원 회복 글은 관리 화면 위 팝업으로)
      resultText={session.outingResult?.effectText ?? null}
      onCloseResult={actions.closeOutingResult}
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
      const isOverStatusBoard =
        story.context === '관리' || story.context === '중간평가' || story.context === '연초' || story.context === '연말'
      const isOverMap = story.context === '지도' || story.context === '장소' || story.context === '대결결과'
      return (
        <>
          {isOverStatusBoard && <PitcherEventUnderlay career={career} />}
          {isOverMap && <OutingMapUnderlay eventPlaceIds={session.eventPlaceIds} hour={new Date().getHours()} />}
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
            onComplete={actions.completeStory}
            carried={story.carried}
            onMatch={(command, carry) =>
              renderAceMatch === undefined ? actions.abortStoryAtMatch(carry) : actions.beginAceMatch(command, carry)
            }
            // 370·375 의 system 3·4 — 타이틀(0x8b3bc, 투수 문구 79~81 · 마무리 82)·MVP(0x8b23c) 발표 창 (130·131 과 같은 판정)
            systemWindowTextOf={(command) =>
              awardWindowTextOf(command.sub, () => judgePitcherSeasonAwards(career))
            }
            // system 1 올해의 목표 창 — 연초 115 · 392 (0x8d304 → 0x86fdc)
            yearGoalWindowOf={() => pitcherYearGoalWindowValuesOf(career)}
            // 보상 명령 7 의 알림 창 — 0x8beb8 글 → 0x74ef4 종류 1 · 첫 종류 4 는 스킬 창 0x741a0 (모드 3 투수편)
            rewardNoticeContext={() => rewardNoticeContextOf(career, PITCHER_LEAGUE_MODE, random)}
          />
          </ScreenOverlay>
        </>
      )
    }
  }

  if (scene === '마선수대결' && session.aceMatch !== null && renderAceMatch !== undefined) {
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
        cup={session.cup.cup}
        // 제 n 회 = (연차 idx >> 1) + 1 (0x85e6c) — 대회는 끝난 해의 연말이라 지금 시즌 − 1
        yearIndex={career.season - 1}
        gamePoint={career.gamePoint}
        random={random}
        onStartGame={actions.startCupGame}
        onFinish={actions.finishCup}
        // 142 취소로 돌아오면 135(순위표)부터
        initialStep={session.cup.atStandings ? '순위' : '대진'}
      />
    )
  }

  if (scene === '시즌종료') {
    return <PitcherSeasonEndScreen career={career} onYearEnd={actions.beginYearEnd} />
  }

  if (scene === '연말') {
    return (
      <PitcherYearEndScreen
        career={career}
        onContinueCareer={actions.continueCareer}
        onRetire={actions.retire}
      />
    )
  }

  if (scene === '엔딩' && career.endingIndex !== null) {
    const endingIndex = career.endingIndex
    return (
      <EndingScreen
        playerName={career.name}
        endingIndex={endingIndex}
        seenEventIds={career.seenEventIds}
        bonusGamePoint={pitcherEndingBonusOf(endingIndex)}
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
          onRegister: (slot) => hallOfFame?.register(career, slot) ?? '빈칸없음',
          ...(hallOfFame?.gamePoint === undefined ? {} : { gamePoint: hallOfFame.gamePoint }),
        }}
        onContinue={actions.continueAfterEnding}
        onFinish={() => {
          actions.finishEnding()
          onExit()
        }}
      />
    )
  }

  if (scene === '상점') {
    // 해금표는 원본에서 전역(app+0xc0)이라 기록연감의 오픈 id 를 얹어 보여 준다 — 구매도 같은 값으로 판정한다
    const missing = openedHiddenIds.filter((id) => !career.openedHiddenIds.includes(id))
    const shopCareer = missing.length === 0
      ? career
      : { ...career, openedHiddenIds: [...career.openedHiddenIds, ...missing] }
    return (
      <PitcherShopScreen
        key={shopTab}
        tab={shopTab}
        career={shopCareer}
        noticeText={shopNotice}
        gpDetail={shopGpDetail}
        onCloseGpDetail={actions.closeShopGpDetail}
        onPurchase={(itemId) => actions.purchase(itemId, openedHiddenIds)}
        // 111 취소 → 110, 121 취소 → 106 이지만 웹 관리 화면은 다시 열 때 105 부터다 (근사)
        onBack={() => actions.goto('관리')}
      />
    )
  }

  if (scene === '외출') return outingMap

  return (
    <>
      {management}
      {/* 126 → 105 뒤 남는 입원 회복 팝업 (0x1575c `0xbbef8(글, 1, 1, 1)`) */}
      {session.outingRecoveryNotice !== '' && (
        <MessageBox text={session.outingRecoveryNotice} buttons={['확인']} onAnswer={actions.dismissOutingRecoveryNotice} />
      )}
      {/* 이벤트 뒤 알림 — 히든 오픈(보상 7, 0x62368) · 옮기지 않은 갈래 */}
      {session.storyNotice !== '' && session.outingRecoveryNotice === '' && (
        <MessageBox text={session.storyNotice} buttons={['확인']} onAnswer={actions.dismissStoryNotice} />
      )}
      {/* 칭호 팝업 0x1274c — 이름 [i+16] · 조건 [i+80] (투수편 i > 31, 0x1afe8). ⚠️ 팝업 틀 배치는 옮기지 않아 알림 상자다 */}
      {session.pendingTitle !== null && (
        <MessageBox
          text={`!C${session.pendingTitle}!N${conditionTextOf(session.pendingTitle) ?? ''}`}
          buttons={['확인']}
          onAnswer={actions.confirmTitle}
        />
      )}
    </>
  )
}
