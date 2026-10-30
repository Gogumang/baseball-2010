import { useState } from 'react'
import { canRegisterPitcher, toggleBreakingPitchSlot } from '@/entities/pitcher-career/model/pitcherRegistration'
import type { PitcherRookieProfile } from '@/entities/pitcher-career/model/pitcherRegistration'
import { BREAKING_PITCH_OK_CELL, breakingPitchCursorAfterToggle } from '@/pages/pitcher-league/lib/breakingPitchCursor'

/** 0x67 의 상자 — StrMODE[13] 알림(1 이하) · StrMODE[2] 확인(2개) */
export type PitchPopup = '부족' | '확인'

/**
 * 0x67 격자 [this+0x88] 칸 — 0~7 구질 · 8 OK. 0x10b18 이 들어올 때마다 0 에 둔다(부르는 쪽이 `setPitchCell(0)`).
 * OK 칸(8)은 0x12410: 고른 수 ≤ 1 이면 StrMODE[13], 아니면 StrMODE[2]. 구질 칸 OK 는 0x123ac 로 켜고/끄고,
 * 개수가 2 면 OK 칸 · 아니면 칸 + 2 (0x124fe~0x12560).
 */
export function useBreakingPitchCell(
  profile: PitcherRookieProfile,
  setProfile: (profile: PitcherRookieProfile) => void,
  setPopup: (popup: PitchPopup) => void,
) {
  const [pitchCell, setPitchCell] = useState(0)
  const pressPitchOk = () => setPopup(canRegisterPitcher(profile) ? '확인' : '부족')
  const togglePitchCell = (cell: number) => {
    const slots = toggleBreakingPitchSlot(profile.breakingPitchSlots, cell)
    setProfile({ ...profile, breakingPitchSlots: slots })
    setPitchCell(breakingPitchCursorAfterToggle(cell, slots.length))
  }
  /** 0x67 OK — 칸 8 이면 상자, 아니면 그 칸 켜고/끄기 (0x12426) */
  const pressPitchCellOk = (cell: number) => (cell === BREAKING_PITCH_OK_CELL ? pressPitchOk() : togglePitchCell(cell))
  return [pitchCell, setPitchCell, togglePitchCell, pressPitchOk, pressPitchCellOk] as const
}
