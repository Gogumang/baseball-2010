import type { ReactNode } from 'react'
import { TitleScreen } from '@/pages/title/ui/TitleScreen'
import { UsageNoticeScreen } from '@/pages/title/ui/UsageNoticeScreen'
import { LogoScreen } from '@/pages/title/ui/LogoScreen'
import type { EntryRoutesProps } from '@/app/ui/entryRoutes/entryRoutesProps'
import { useEntryRouteState } from '@/app/ui/entryRoutes/useEntryRouteState'
import type { EntryRouteView } from '@/app/ui/entryRoutes/useEntryRouteState'
import { createPlayerScreenOf, helpScreenOf, settingsScreenOf, specialScreenOf, teamSelectScreenOf } from '@/app/ui/entryRoutes/menuScreens'
import { derbyScreenOf } from '@/app/ui/entryRoutes/derbyScreen'
import { mainMenuScreenOf } from '@/app/ui/entryRoutes/mainMenu'

/** 켤 때 앞 화면 셋 — 하위 0x2a <이용안내> → (아무 키) 하위 2 로고 → (답 1) 하위 3 타이틀. 그 밖은 null */
function bootScreenOf({ screen, setScreen, onLogoVoice }: EntryRouteView): ReactNode {
  if (screen.kind === '이용안내') return <UsageNoticeScreen onNext={() => setScreen({ kind: '로고' })} />
  if (screen.kind === '로고') {
    return <LogoScreen onDone={() => setScreen({ kind: '타이틀' })} {...(onLogoVoice === undefined ? {} : { onVoice: onLogoVoice })} />
  }
  if (screen.kind === '타이틀') return <TitleScreen onStart={() => setScreen({ kind: '메인메뉴', isFromTitle: true })} />
  return null
}

/** 메뉴 장면 0x103 안의 화면 — 종류마다 한 갈래, 나머지는 메인 메뉴 */
function menuScreenOf(view: EntryRouteView): ReactNode {
  const { screen } = view
  switch (screen.kind) {
    case '도움말':
      return helpScreenOf(view, screen)
    case '스페셜':
      return specialScreenOf(view)
    case '환경설정':
      return settingsScreenOf(view)
    case '팀선택':
      return teamSelectScreenOf(view)
    case '선수등록':
      return createPlayerScreenOf(view, screen)
    case '홈런더비':
      return derbyScreenOf(view)
    default:
      return mainMenuScreenOf(view)
  }
}

/** 커리어가 아직 없을 때의 화면 — 타이틀 → 메인 메뉴(도움말) → 선수 등록. */
export function EntryRoutes(props: EntryRoutesProps) {
  const { isGeneralGameInProgress = false, lastPlayedMode = 1 } = props
  const routeState = useEntryRouteState(props)
  const view: EntryRouteView = { ...props, ...routeState, isGeneralGameInProgress, lastPlayedMode }
  return bootScreenOf(view) ?? menuScreenOf(view)
}
