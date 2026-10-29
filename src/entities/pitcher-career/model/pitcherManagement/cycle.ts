import { GAMES_PER_MANAGEMENT_CYCLE } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'

/** 관리 화면이 열리기까지 남은 경기 수 (2경기 주기 — StrHOWTO[11] · 관리 장면 상태 116) */
export function gamesUntilManagementOf(career: PitcherCareer): number {
  const played = career.gamesPlayed % GAMES_PER_MANAGEMENT_CYCLE
  return played === 0 ? 0 : GAMES_PER_MANAGEMENT_CYCLE - played
}
