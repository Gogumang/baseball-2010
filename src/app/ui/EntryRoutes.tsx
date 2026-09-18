import type { Screen } from '@/app/model/screen'
import type { useCareerSession } from '@/app/model/useCareerSession'
import type { useGameSettings } from '@/app/model/useGameSettings'
import type { Collection } from '@/entities/collection/model/collection'
import { SpecialScreen } from '@/pages/special/ui/SpecialScreen'
import { TitleScreen } from '@/pages/title/ui/TitleScreen'
import { MainMenuScreen } from '@/pages/main-menu/ui/MainMenuScreen'
import { CreatePlayerScreen } from '@/pages/create-player/ui/CreatePlayerScreen'
import { HelpScreen } from '@/pages/help/ui/HelpScreen'
import { SettingsScreen } from '@/pages/settings/ui/SettingsScreen'

interface EntryRoutesProps {
  readonly screen: Screen
  readonly setScreen: (screen: Screen) => void
  readonly session: ReturnType<typeof useCareerSession>
  readonly gameSettings: ReturnType<typeof useGameSettings>
  readonly collection: Collection
}

/** 커리어가 아직 없을 때의 화면 — 타이틀 → 메인 메뉴(도움말) → 선수 등록. */
export function EntryRoutes({ screen, setScreen, session, gameSettings, collection }: EntryRoutesProps) {
  if (screen.kind === '타이틀') {
    return <TitleScreen onStart={() => setScreen({ kind: '메인메뉴' })} />
  }

  if (screen.kind === '도움말') {
    return <HelpScreen onBack={() => setScreen({ kind: '메인메뉴' })} />
  }

  if (screen.kind === '스페셜') {
    return <SpecialScreen collection={collection} onBack={() => setScreen({ kind: '메인메뉴' })} />
  }

  if (screen.kind === '환경설정') {
    return (
      <SettingsScreen
        settings={gameSettings.settings}
        hasSavedCareer={session.savedCareer !== null}
        onChange={gameSettings.setSettings}
        onResetCareer={session.actions.resetCareer}
        onBack={() => setScreen({ kind: '메인메뉴' })}
      />
    )
  }

  if (screen.kind === '선수등록') {
    return (
      <CreatePlayerScreen
        onCreate={session.actions.startNewCareer}
        onCancel={() => setScreen({ kind: '메인메뉴' })}
      />
    )
  }

  return (
    <MainMenuScreen
      hasSavedGame={session.savedCareer !== null}
      onContinue={session.actions.continueSaved}
      onNewGame={() => setScreen({ kind: '선수등록' })}
      onSelectMode={(mode) => {
        if (mode === '미션') setScreen({ kind: '미션선택' })
      }}
      onBack={() => setScreen({ kind: '타이틀' })}
      onHelp={() => setScreen({ kind: '도움말' })}
      onSettings={() => setScreen({ kind: '환경설정' })}
      onSpecial={() => setScreen({ kind: '스페셜' })}
    />
  )
}
