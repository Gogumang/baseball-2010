import { useState } from 'react'
import type { Screen } from '@/app/model/screen'
import { MessageBox } from '@/shared/ui'
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
  const [isMissionBlocked, setMissionBlocked] = useState(false)

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

  if (isMissionBlocked) {
    return (
      <MessageBox
        text="나만의리그 선수를 먼저 등록해야합니다"
        buttons={['확인']}
        onAnswer={() => setMissionBlocked(false)}
      />
    )
  }

  return (
    <MainMenuScreen
      hasSavedGame={session.savedCareer !== null}
      onContinue={session.actions.continueSaved}
      onNewGame={() => setScreen({ kind: '선수등록' })}
      onSelectMode={(mode) => {
        if (mode !== '미션') return
        // 원본은 **육성 선수도 명예의 전당 선수도 없으면 미션에 못 들어간다** (Q2 3-1 확정).
        // 코드 5 → StrCOMMON[38] 팝업만 띄우고 되돌아간다. 신인 능력치로 대신 넣어 주는 길은 없다.
        // 웹에는 아직 명예의 전당이 없으니 육성 선수만 본다.
        if (session.career === null && session.savedCareer === null) {
          return setMissionBlocked(true)
        }
        setScreen({ kind: '미션선택' })
      }}
      onBack={() => setScreen({ kind: '타이틀' })}
      onHelp={() => setScreen({ kind: '도움말' })}
      onSettings={() => setScreen({ kind: '환경설정' })}
      onSpecial={() => setScreen({ kind: '스페셜' })}
    />
  )
}
