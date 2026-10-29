import { useEffect, type RefObject } from 'react'
import { noteSkinShakeKey } from '@/shared/lib/cursorShake/skinShakeDirection'
import { runMatchInfoKey } from './otherSlices'

interface SeasonMatchInfoKeysInput {
  /** [[0x1552cfc]+0xe4] — 값 줄 펼침 끝 (`useMatchInfoEntry`) */
  readonly isKeyReady: RefObject<boolean>
  readonly isSettingsOpen: boolean
  readonly onStart: () => void
  readonly onOpenSettings: () => void
  readonly onCancel: () => void
  readonly onOpenEntry: ((isUserTeam: boolean) => void) | undefined
}

/** 키 0x83cc — 의존성이 바뀔 때마다 다시 건다(옛 등록 차례 그대로) */
export function useSeasonMatchInfoKeys({ isKeyReady, isSettingsOpen, onStart, onOpenSettings, onCancel, onOpenEntry }: SeasonMatchInfoKeysInput) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 키 함수 맨 앞 — [[0x1552cfc]+0xe4](값 줄 펼침 끝) == 0 이면 아무것도 안 한다 (`isMatchInfoKeyReadyAt`)
      if (!isKeyReady.current) return
      // 설정 창이 열렸으면([skin+0x2ba]) 키는 창 0x5ffcd 로만 간다(83f2~8402). 아니면 **날 키**를 0x5550d 에 넘긴다(8410~8414) —
      // 화살표면 까딱임 방향 [skin+0x8c] 에 남는다(Q-10)
      if (!isSettingsOpen) noteSkinShakeKey(event.key)
      // 0x83cc: −5(OK)·'5'(0x35, 0x8442) → 0x847e 경기 시작 · '0' → 설정 · CLR → 취소 ·
      // −3·'4' → this+0x120 = 1 (유저 팀) · −4·'6' → 0 (CPU 팀) → 0xe0
      runMatchInfoKey(event, {
        start: onStart,
        settings: onOpenSettings,
        cancel: onCancel,
        ...(onOpenEntry === undefined ? {} : { userEntry: () => onOpenEntry(true), cpuEntry: () => onOpenEntry(false) }),
      })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [isSettingsOpen, onStart, onOpenSettings, onCancel, onOpenEntry, isKeyReady])
}
