import { useEffect, useRef, useState } from 'react'
import { normalizeSettings } from '@/entities/settings/model/gameSettings'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { setGameSpeedLevel } from '@/shared/config/frameRate'
import type { JsonStorePort } from '@/shared/api/save/jsonStorePort'

/**
 * 환경설정을 불러오고 게임 속도에 반영한다.
 *
 * - `setSettings`: 바꾸고 곧바로 저장한다 (경기 중 "설정" · 홈런더비 등 — 그쪽 저장 시점은 아직 안 읽었다).
 * - `changeSettings` + `saveSettings`: 메인 메뉴 환경설정(상태 8)용. 원본은 값을 바꿀 때 메모리만 고치고
 *   **첫 화면을 OK 칸·CLR 로 나갈 때(0x295e2) 한 번** 0x1f1b9 로 파일에 쓴다 — 상세 설정(0x20)에서 바꾼 값도 그때 함께 쓴다.
 */
export function useGameSettings(settingsStore: JsonStorePort) {
  const [settings, setSettingsState] = useState<GameSettings>(() => normalizeSettings(settingsStore.load()))
  const settingsRef = useRef(settings)
  settingsRef.current = settings
  /** 마지막 변경이 저장을 미룬 것인가 */
  const isDeferredRef = useRef(false)

  useEffect(() => {
    setGameSpeedLevel(settings.speedLevel)
    if (isDeferredRef.current) return
    settingsStore.save(settings)
  }, [settings, settingsStore])

  const setSettings = (next: GameSettings) => {
    isDeferredRef.current = false
    setSettingsState(next)
  }
  const changeSettings = (next: GameSettings) => {
    isDeferredRef.current = true
    setSettingsState(next)
  }
  const saveSettings = () => {
    isDeferredRef.current = false
    settingsStore.save(settingsRef.current)
  }

  return { settings, setSettings, changeSettings, saveSettings }
}
