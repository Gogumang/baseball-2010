import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { ROW_ICONS, SOUND_OFF_ICON, VIBRATION_ON_ICON } from '@/pages/settings/lib/settingsLayout'

/** 줄 아이콘 — 소리 0 이면 끈 아이콘, 진동이 켜졌으면 켠 아이콘 */
export function rowIconOf(index: number, settings: GameSettings) {
  if (index === 0 && settings.soundLevel === 0) return SOUND_OFF_ICON
  if (index === 2 && settings.isVibrationOn) return VIBRATION_ON_ICON
  return ROW_ICONS[index]
}
