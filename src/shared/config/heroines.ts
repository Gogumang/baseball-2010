import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import type { AcePlayer } from '@/shared/config/original/acePlayers'
import { CHARACTER_COLORS } from '@/shared/config/design'

/**
 * 마선수 — 원작의 특별 상대. 원본 XlsACE_BAT_DATA / XlsACE_PIT_DATA에서 가져온다.
 * 이름과 능력치는 원본 그대로이고, 표시용 색만 여기서 정한다.
 */
export interface Heroine extends AcePlayer {
  readonly accentColor: string
}

const ACCENT_COLORS: Readonly<Record<string, string>> = {
  medica: CHARACTER_COLORS.medica,
  kao: CHARACTER_COLORS.kao,
  roze: CHARACTER_COLORS.roze,
  death: CHARACTER_COLORS.death,
  tiger: CHARACTER_COLORS.tiger,
  psyker: CHARACTER_COLORS.psyker,
  leony: CHARACTER_COLORS.leony,
  bbmachine: CHARACTER_COLORS.bbmachine,
  ballantine: CHARACTER_COLORS.ballantine,
  dragona: CHARACTER_COLORS.dragona,
}

const FALLBACK_ACCENT = CHARACTER_COLORS.fallback

export const HEROINES: readonly Heroine[] = ACE_PLAYERS.map((ace) => ({
  ...ace,
  accentColor: ACCENT_COLORS[ace.id] ?? FALLBACK_ACCENT,
}))

export function findHeroine(heroineId: string): Heroine | null {
  return HEROINES.find((heroine) => heroine.id === heroineId) ?? null
}
