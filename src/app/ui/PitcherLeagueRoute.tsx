import { PitcherCreateFlow } from '@/pages/pitcher-league/ui/PitcherCreateFlow'
import { PitcherManagementScreen } from '@/pages/pitcher-league/ui/PitcherManagementScreen'
import { PitcherSeasonEndScreen } from '@/pages/pitcher-league/ui/PitcherSeasonEndScreen'
import { PitcherYearEndScreen } from '@/pages/pitcher-league/ui/PitcherYearEndScreen'
import { PitcherGameScreen } from '@/pages/pitching/ui/PitcherGameScreen'
import { EndingScreen } from '@/pages/ending/ui/EndingScreen'
import {
  isContinuablePitcherEnding,
  pitcherEndingBonusOf,
} from '@/entities/pitcher-career/model/pitcherSeasonFlow'
import { PITCHER_EDITION_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import type { PitcherLeagueSession } from '@/app/model/usePitcherLeagueSession'
import type { RandomPort } from '@/shared/api/random/randomPort'
import type { useGameSettings } from '@/app/model/useGameSettings'

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
 * `onOuting`/`onOpenShop` 은 투수편 외출(112)·상점(110/111) 화면이 생기면 그때 넘긴다 —
 * 지금은 그 칸을 누르면 화면이 "아직 옮기지 않은 화면입니다" 를 띄운다.
 */
export function PitcherLeagueRoute({
  session, random, openedHiddenIds = [], gameSettings, onExit,
}: PitcherLeagueRouteProps) {
  const { career, scene, gameOptions, actions } = session

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

  return (
    <PitcherManagementScreen
      career={career}
      random={random}
      onSave={actions.save}
      onNextGame={actions.beginGame}
      onExit={onExit}
    />
  )
}
