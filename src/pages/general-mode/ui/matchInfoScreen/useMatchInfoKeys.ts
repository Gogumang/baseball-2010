import { useEffect } from 'react'
import { noteSkinShakeKey } from '@/shared/lib/cursorShake/skinShakeDirection'

type MatchInfoKeyAction = 'start' | 'settings' | 'respin' | 'cancel' | 'userEntry' | 'cpuEntry'

/**
 * 갱신 0x311a8 의 키 — OK −5 와 '5' 는 같은 0x31322 경기 시작(312f0 · 31318 `cmp r4,#0x35`, r333) · '0' 설정 창 · '*' 재굴림(빠른실행만) ·
 * CLR · '4'/왼 → 메뉴+0xec = 1 (유저 팀) · '6'/오른 → 0 (CPU 팀) → 상태 23
 */
const MATCH_INFO_KEYS = new Map<string, MatchInfoKeyAction>([
  ['Enter', 'start'],
  ['5', 'start'],
  ['0', 'settings'],
  ['*', 'respin'],
  ['Escape', 'cancel'],
  ['ArrowLeft', 'userEntry'],
  ['4', 'userEntry'],
  ['ArrowRight', 'cpuEntry'],
  ['6', 'cpuEntry'],
])

export interface MatchInfoKeyHandlers {
  readonly isQuickStart: boolean
  readonly isRespinning: boolean
  readonly isSettingsOpen: boolean
  readonly onStart: () => void
  readonly onOpenSettings: () => void
  readonly onRespin: () => void
  readonly onCancel: () => void
  readonly onOpenEntry: ((isUserTeam: boolean) => void) | undefined
}

/** 이 화면에서 받지 않는 키 — 재굴림은 빠른실행만, 엔트리는 손잡이가 있을 때만 */
function isActionOff(action: MatchInfoKeyAction, handlers: MatchInfoKeyHandlers): boolean {
  if (action === 'respin') return !handlers.isQuickStart
  if (action === 'userEntry' || action === 'cpuEntry') return handlers.onOpenEntry === undefined
  return false
}

function runAction(action: MatchInfoKeyAction, handlers: MatchInfoKeyHandlers) {
  if (action === 'start') return handlers.onStart()
  if (action === 'settings') return handlers.onOpenSettings()
  if (action === 'respin') return handlers.onRespin()
  if (action === 'cancel') return handlers.onCancel()
  handlers.onOpenEntry?.(action === 'userEntry')
}

export function useMatchInfoKeys(handlers: MatchInfoKeyHandlers, isKeyReady: { readonly current: boolean }) {
  const { isQuickStart, isRespinning, isSettingsOpen, onStart, onOpenSettings, onRespin, onCancel, onOpenEntry } = handlers
  useEffect(() => {
    const current: MatchInfoKeyHandlers = { isQuickStart, isRespinning, isSettingsOpen, onStart, onOpenSettings, onRespin, onCancel, onOpenEntry }
    const onKeyDown = (event: KeyboardEvent) => {
      // 키 함수 맨 앞 — [[0x1552cfc]+0xe4](값 줄 펼침 끝) == 0 이면 아무것도 안 한다 (`isMatchInfoKeyReadyAt`)
      if (!isKeyReady.current) return
      // 0x311a8: 빠른실행이고 [메뉴+0x154] ≤ 0x13(재굴림이 도는 중)이면 312ba 에서 끝 — 키를 안 본다
      if (isRespinning) return
      // 설정 창이 열렸으면([skin+0x2ba]) 키는 창 0x5ffcd 로만 간다(312bc~312ce). 아니면 **날 키**를 0x5550d 에 넘긴다(312dc~312e2) —
      // 화살표면 까딱임 방향 [skin+0x8c] 에 남는다(Q-10)
      if (!isSettingsOpen) noteSkinShakeKey(event.key)
      const action = MATCH_INFO_KEYS.get(event.key)
      if (action === undefined || isActionOff(action, current)) return
      event.preventDefault()
      runAction(action, current)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isQuickStart, isRespinning, isSettingsOpen, onStart, onOpenSettings, onRespin, onCancel, onOpenEntry, isKeyReady])
}
