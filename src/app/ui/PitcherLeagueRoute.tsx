import { PitcherCreateFlow } from '@/pages/pitcher-league/ui/PitcherCreateFlow'
import { PitcherManagementScreen } from '@/pages/pitcher-league/ui/PitcherManagementScreen'
import { PitcherGameScreen } from '@/pages/pitching/ui/PitcherGameScreen'
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
 * 등록(0x65 → 0x66) → 관리(상태 105 허브) → 경기 → 정산 한 바퀴다.
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
