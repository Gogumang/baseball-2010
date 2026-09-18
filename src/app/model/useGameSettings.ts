import { useEffect, useState } from 'react'
import { normalizeSettings } from '@/entities/settings/model/gameSettings'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { setGameSpeedLevel } from '@/shared/config/frameRate'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'

/** 환경설정을 불러오고, 바뀔 때마다 저장하고 게임 속도에 반영한다. */
export function useGameSettings(settingsStore: JsonStorePort) {
  const [settings, setSettings] = useState<GameSettings>(() => normalizeSettings(settingsStore.load()))

  useEffect(() => {
    setGameSpeedLevel(settings.speedLevel)
    settingsStore.save(settings)
  }, [settings, settingsStore])

  return { settings, setSettings }
}
