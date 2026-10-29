import { useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import type { GeneralModeStep } from '@/pages/general-mode/lib/generalModeSetup'
import { GENERAL_MODE_STEP } from '@/pages/general-mode/lib/generalModeSetup'
import type { MatchSettingsSeenSlot } from './generalModeTypes'

/**
 * 22 진입의 +0x11e 검사 (0x3163c~0x31688) — 23 에서 돌아온 길(0x314ce)도 이 자리로 뛰지만 그때는 이미 1 이다.
 * 0 이면 창을 열고 1 · 저장. 빠른실행은 처음부터 22 라 첫 그림 뒤 한 번 돈다(아래 effect). 돌려주는 검사는 고르기(이벤트)가 부른다.
 */
export function useMatchSettingsSeen(
  matchSettingsSeen: MatchSettingsSeenSlot | undefined,
  initialStep: GeneralModeStep,
  openSettings: (isOpen: boolean) => void,
) {
  // 고르기(이벤트) · 첫 그림 효과가 함께 보는 칸 — 커밋 때 적는다
  const seenSlotRef = useRef(matchSettingsSeen)
  useLayoutEffect(() => {
    seenSlotRef.current = matchSettingsSeen
  })
  const checkMatchSettingsSeen = useCallback(() => {
    const slot = seenSlotRef.current
    if (slot === undefined || slot.read()) return
    openSettings(true)
    slot.markSeen()
  }, [openSettings])
  useEffect(() => {
    if (initialStep === GENERAL_MODE_STEP.경기정보) checkMatchSettingsSeen()
  }, [initialStep, checkMatchSettingsSeen])
  return checkMatchSettingsSeen
}
