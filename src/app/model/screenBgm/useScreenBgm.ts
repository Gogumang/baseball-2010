import { useState } from 'react'
import type { Screen } from '@/app/model/screen'
import type { PitcherScene } from '@/app/model/usePitcherLeagueSession'
import {
  restartsMenuBgm,
  restartsTeamSelectBgm,
  restartsManagementBgm,
  restartsNextGameStandingsBgm,
  carriesYearCoverBgm,
} from '@/app/model/screenBgm/bgmRestarts'
import { screenBgmOf } from '@/app/model/screenBgm/screenBgmOf'

/**
 * 화면이 '관리' 인 채 105 에 다시 들어와 배경음 4 를 다시 튼 수(`restartsManagementBgmFrom` — 세션이 센다)가 오른 그리기에서
 * 참을 한 번 돌려준다. 오른 그리기에 화면이 '관리' 가 아니면(같은 손짓으로 다른 화면으로 갔다) 무시한다.
 */
export function useManagementBgmRestart(isAtManagement: boolean, managementBgmRestart: number): boolean {
  const [seen, setSeen] = useState(managementBgmRestart)
  if (seen === managementBgmRestart) return false
  setSeen(managementBgmRestart)
  return isAtManagement
}

/** 투수편 안쪽 장면이 바뀐 그림 — 112 → 105 · 109 진입이 배경음을 처음부터 다시 튼다 */
function restartsPitcherSceneBgm(previousScene: PitcherScene | null, current: PitcherScene | null): boolean {
  if (current === null) return false
  return restartsManagementBgm(previousScene, current) || restartsNextGameStandingsBgm(previousScene, current)
}

/** 최상위 화면이 바뀐 그림 — 메뉴 · 관리 · 팀 고르기 · 109 진입이 배경음을 처음부터 다시 튼다 */
function restartsScreenBgm(previousKind: Screen['kind'] | null, screen: Screen): boolean {
  return (
    restartsMenuBgm(previousKind, screen) ||
    restartsManagementBgm(previousKind, screen.kind) ||
    restartsTeamSelectBgm(previousKind, screen.kind) ||
    restartsNextGameStandingsBgm(previousKind, screen.kind)
  )
}

/**
 * 투수편(장면 0x106) 안쪽 장면의 **다시 틀기 표** — 타자편과 같은 105 처리 0x1aec4 라 외출 지도(112) → 관리(105)에서
 * 오른다(`restartsManagementBgm`). `useSceneBgm` 의 다시 틀기 표에 더해 넘긴다.
 */
export function usePitcherLeagueBgmRestart(
  isActive: boolean,
  scene: PitcherScene,
  /** 화면이 '관리' 인 채 105 에 다시 들어와 4 를 다시 튼 수 — 투수편 세션의 `managementBgmRestart` */
  managementBgmRestart = 0,
): number {
  const [previousScene, setPreviousScene] = useState<PitcherScene | null>(null)
  const [restartSerial, setRestartSerial] = useState(0)
  const current = isActive ? scene : null
  if (useManagementBgmRestart(current === '관리', managementBgmRestart)) setRestartSerial((serial) => serial + 1)
  if (current !== previousScene) {
    setPreviousScene(current)
    if (restartsPitcherSceneBgm(previousScene, current)) setRestartSerial((serial) => serial + 1)
  }
  return restartSerial
}

/**
 * 최상위 화면의 배경음과 **다시 틀기 표** — 화면이 바뀐 그리기에서 `restartsMenuBgm` · `restartsManagementBgm` 이 참이면 표가 하나 오른다.
 * `useSceneBgm` 이 표가 오르면 같은 번호라도 끊고 처음부터 튼다.
 */
export function useScreenBgm(
  screen: Screen,
  /** 화면이 '관리' 인 채 105 에 다시 들어와 4 를 다시 튼 수 — 나리 타자편 세션 쪽 `managementBgmRestart` */
  managementBgmRestart = 0,
): { readonly bgm: number | null; readonly restartSerial: number } {
  const [previousKind, setPreviousKind] = useState<Screen['kind'] | null>(null)
  const [enteredFrom, setEnteredFrom] = useState<Screen['kind'] | null>(null)
  const [restartSerial, setRestartSerial] = useState(0)
  const [isYearCoverCarry, setYearCoverCarry] = useState(false)
  // 125 → 105 — 0x1aec4 가 4 를 처음부터 다시 튼다(137 뒤 잇던 배경음도 여기서 끝난다)
  if (useManagementBgmRestart(screen.kind === '관리', managementBgmRestart)) {
    setRestartSerial((serial) => serial + 1)
    setYearCoverCarry(false)
  }
  // 그리는 중에 앞 값과 견줘 고친다 (`usePitcherLeagueBgm` 과 같은 꼴 — 효과 한 틀 늦지 않게)
  if (screen.kind !== previousKind) {
    setPreviousKind(screen.kind)
    setEnteredFrom(previousKind)
    setYearCoverCarry(carriesYearCoverBgm(isYearCoverCarry, previousKind, screen.kind))
    if (restartsScreenBgm(previousKind, screen)) setRestartSerial((serial) => serial + 1)
  }
  return { bgm: isYearCoverCarry ? null : screenBgmOf(screen, enteredFrom), restartSerial }
}
