import { PitcherCreateFlow } from '@/pages/pitcher-league/ui/PitcherCreateFlow'
import { PitcherManagementScreen } from '@/pages/pitcher-league/ui/PitcherManagementScreen'
import { PitcherSeasonEndScreen } from '@/pages/pitcher-league/ui/PitcherSeasonEndScreen'
import { PitcherYearEndScreen } from '@/pages/pitcher-league/ui/PitcherYearEndScreen'
import { PitcherGameScreen } from '@/pages/pitching/ui/PitcherGameScreen'
import { PitcherShopScreen } from '@/pages/shop/ui/PitcherShopScreen'
import { EndingScreen } from '@/pages/ending/ui/EndingScreen'
import { OutingMapScreen } from '@/pages/outing-map/ui/OutingMapScreen'
import {
  isContinuablePitcherEnding,
  pitcherEndingBonusOf,
} from '@/entities/pitcher-career/model/pitcherSeasonFlow'
import { PITCHER_EDITION_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import type { PitcherLeagueSession } from '@/app/model/usePitcherLeagueSession'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { useGameSettings } from '@/app/model/useGameSettings'

const NO_EVENT_PLACES: ReadonlySet<string> = new Set()

interface PitcherLeagueRouteProps {
  readonly session: PitcherLeagueSession
  readonly random: RandomPort
  readonly openedHiddenIds?: readonly number[]
  /** 경기 중 메뉴 "설정" 칸 */
  readonly gameSettings: ReturnType<typeof useGameSettings>
  readonly onExit: () => void
}

/**
 * 나만의리그 **투수편** 라우팅 (원본 게임 모드 3, 장면 0x106).
 *
 * 등록(0x65 → 0x66) → 관리(상태 105 허브) → 경기 → 정산 한 바퀴를 돌다가,
 * 45경기를 다 치르면 **시즌종료(136 자리) → 연말(132) → 엔딩(141)** 로 빠진다.
 * 관리 화면 안의 선수정보·트레이닝·구질 훈련·휴식은 `PitcherManagementScreen` 이 스스로 돈다.
 *
 * [외출] → **112 외출 지도** 는 타자편 화면(`OutingMapScreen`)을 그대로 쓴다 — 원본 모드 3·4 가 같은 상태·
 * 같은 코드(지도 0x7ea64 · 장소 0x16c64 · 효과 0x15234)를 돈다. 다만 [!] 표시(장소 이벤트 배정 0x8cdc0)는
 * 투수편 이벤트 재생이 아직 없어 비워 둔다 (**미해결**).
 * 상점은 [아이템] → 110 → **111 상점**(장비·서브·GP) · [선수정보] → **121 장비착용** 이 `PitcherShopScreen` 으로 간다.
 */
export function PitcherLeagueRoute({
  session, random, openedHiddenIds = [], gameSettings, onExit,
}: PitcherLeagueRouteProps) {
  const { career, scene, gameOptions, shopTab, shopNotice, shopGpDetail, actions } = session

  if (career === null || scene === '등록') {
    return <PitcherCreateFlow openedHiddenIds={openedHiddenIds} onCreate={actions.create} onCancel={onExit} />
  }

  if (scene === '경기' && gameOptions !== null) {
    return (
      <PitcherGameScreen
        options={gameOptions}
        random={random}
        onFinish={actions.finishGame}
        onQuit={() => actions.goto('관리')}
        settings={gameSettings.settings}
        onSettingsChange={gameSettings.setSettings}
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

  if (scene === '외출') {
    return (
      <OutingMapScreen
        career={career}
        noticeText={session.outingNotice}
        onRun={actions.runOutingFunction}
        // 112 취소 → 105 (키 0x13ba4)
        onBack={() => actions.goto('관리')}
        // ⚠️ 미해결: 장소 이벤트 배정(0x8cdc0)·재생(114)이 투수편 웹에 없어 [!] 를 띄우지 않는다
        eventPlaceIds={NO_EVENT_PLACES}
        onEnter={actions.enterOutingPlace}
      />
    )
  }

  return (
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
}
