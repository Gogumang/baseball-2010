import { PitcherCreateFlow } from '@/pages/pitcher-league/ui/PitcherCreateFlow'
import { PitcherManagementScreen } from '@/pages/pitcher-league/ui/PitcherManagementScreen'
import { PitcherSeasonEndScreen } from '@/pages/pitcher-league/ui/PitcherSeasonEndScreen'
import { PitcherYearEndScreen } from '@/pages/pitcher-league/ui/PitcherYearEndScreen'
import { PitcherGameScreen } from '@/pages/pitching/ui/PitcherGameScreen'
import { PitcherShopScreen } from '@/pages/shop/ui/PitcherShopScreen'
import { EndingScreen } from '@/pages/ending/ui/EndingScreen'
import { OutingMapScreen } from '@/pages/outing-map/ui/OutingMapScreen'
import { StoryScreen } from '@/pages/story/ui/StoryScreen'
import { MessageBox, ScreenOverlay } from '@/shared/ui'
import { TEAMS } from '@/shared/config/original/teams'
import {
  isContinuablePitcherEnding,
  pitcherEndingBonusOf,
} from '@/entities/pitcher-career/model/pitcherSeasonFlow'
import { PITCHER_EDITION_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import type { ReactNode } from 'react'
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
 * 45경기를 다 치르면 **시즌종료(136 자리) → 연말(132) → 엔딩(141)** 로 빠진다.
 * 관리 화면 안의 선수정보·트레이닝·구질 훈련·휴식은 `PitcherManagementScreen` 이 스스로 돈다.
 *
 * [외출] → **112 외출 지도** 는 타자편 화면(`OutingMapScreen`)을 그대로 쓴다 — 원본 모드 3·4 가 같은 상태·
 * 같은 코드(지도 0x7ea64 · 장소 0x16c64 · 효과 0x15234 · [!] 배정 0x8cdc0)를 돈다.
 * **114 이벤트 재생**은 타자편 `StoryScreen` 을 그대로 쓴다 — 원본도 모드 3·4 가 같은 재생기(0x8be20 · 0x8b804)다.
 * 주인공 초상화는 피부 팔레트만 따른다: 장타형 +8(0x63a70)은 `모드 == 4` 일 때만이라 투수는 늘 +0 이다.
 * 상점은 [아이템] → 110 → **111 상점**(장비·서브·GP) · [선수정보] → **121 장비착용** 이 `PitcherShopScreen` 으로 간다.
 */
export function PitcherLeagueRoute({
  session, random, openedHiddenIds = [], gameSettings, onExit, renderAceMatch,
}: PitcherLeagueRouteProps) {
  const { career, scene, gameOptions, shopTab, shopNotice, shopGpDetail, actions } = session

  if (career === null || scene === '등록') {
    return <PitcherCreateFlow openedHiddenIds={openedHiddenIds} onCreate={actions.create} onCancel={onExit} />
  }

  if (scene === '경기' && gameOptions !== null) {
    return (
      <PitcherGameScreen
        options={gameOptions}
        pitcherName={career.name}
        random={random}
        onFinish={actions.finishGame}
        onQuit={() => actions.goto('관리')}
        settings={gameSettings.settings}
        onSettingsChange={gameSettings.setSettings}
      />
    )
  }

  const management = (
    <PitcherManagementScreen
      career={career}
      random={random}
      onSave={actions.save}
      onNextGame={actions.beginGame}
      onOuting={actions.openOuting}
      onOpenShop={actions.openShop}
      onExit={onExit}
    />
  )

  const outingMap = (
    <OutingMapScreen
      career={career}
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
      // 대사창은 그 상태의 화면 위에 얹힌다 — 105 에서 튼 것(자동 발동·연초 115·중간평가 117·대결 결과 140)은 관리 화면 위,
      // 112 자동 발동은 지도 위다
      const isOverManagement =
        story.context === '관리' || story.context === '중간평가' || story.context === '연초' || story.context === '대결결과'
      return (
        <>
          {isOverManagement && management}
          {story.context === '지도' && outingMap}
          <ScreenOverlay>
          <StoryScreen
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
          />
          </ScreenOverlay>
        </>
      )
    }
  }

  if (scene === '마선수대결' && session.aceMatch !== null && renderAceMatch !== undefined) {
    return <>{renderAceMatch(session.aceMatch, actions.finishAceMatch)}</>
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
        bonusGamePoint={pitcherEndingBonusOf(endingIndex)}
        isContinuable={isContinuablePitcherEnding(endingIndex)}
        // 걸어 들어오는 그림은 모드 3 이면 애니 2 로 고정이다 (endingLayout `endingWalkInAnimationOf`)
        walkInLook={{
          mode: PITCHER_EDITION_MODE,
          typeIndex: career.typeIndex,
          handIndex: career.handIndex,
          skinIndex: career.skinIndex,
        }}
        // ⚠️ **막힌 곳**: 명예의 전당 145 는 투수 칸이 2개인데(`entities/collection` 머리글),
        // 웹 기록연감에는 타자 4칸만 있고 등록 함수도 `PlayerCareer` 를 받는다 —
        // 투수는 아직 등록할 데가 없어 StrCOMMON[51] "빈슬롯이 없습니다" 로 돌려보낸다.
        onRegister={() => '빈칸없음'}
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
      {/* 이벤트 뒤 알림 — 히든 오픈(보상 7, 0x62368) · 옮기지 않은 갈래(투수편 국가대항전) */}
      {session.storyNotice !== '' && session.outingRecoveryNotice === '' && (
        <MessageBox text={session.storyNotice} buttons={['확인']} onAnswer={actions.dismissStoryNotice} />
      )}
    </>
  )
}
