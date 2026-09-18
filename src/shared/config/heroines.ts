import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import type { AcePlayer } from '@/shared/config/original/acePlayers'

/**
 * 마선수 — 원작의 특별 상대. 원본 XlsACE_BAT_DATA / XlsACE_PIT_DATA에서 가져온다.
 * 이름과 능력치는 원본 그대로이고, 표시용 색만 여기서 정한다.
 */
export interface Heroine extends AcePlayer {
  readonly accentColor: string
}

const ACCENT_COLORS: Readonly<Record<string, string>> = {
  medica: '#6fdc8c',
  kao: '#ffa657',
  roze: '#ff7eb6',
  death: '#a78bfa',
  tiger: '#ffd23f',
  psyker: '#7dd3fc',
  leony: '#f472b6',
  bbmachine: '#94a3b8',
  ballantine: '#fb923c',
  dragona: '#4ade80',
}

const FALLBACK_ACCENT = '#8f9cb5'

export const HEROINES: readonly Heroine[] = ACE_PLAYERS.map((ace) => ({
  ...ace,
  accentColor: ACCENT_COLORS[ace.id] ?? FALLBACK_ACCENT,
}))

export function findHeroine(heroineId: string): Heroine | null {
  return HEROINES.find((heroine) => heroine.id === heroineId) ?? null
}
