import { useEffect, useRef } from 'react'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import { SEASON_DEFAULT_MATCH_SETTINGS } from '@/app/model/seasonSession/constants/seasonConstants'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'
import { type SeasonScope, useSeasonValue } from '@/app/model/seasonSession/atoms/seasonScope'
import {
  carriedGlobalsAtom,
  globalMatchSettingsAtom,
  loadedSaveAtom,
  matchSettingsMirrorAtom,
  saveAtom,
} from '@/app/model/seasonSession/atoms/saveAtoms'

/** 전역 칸 손잡이가 주인일 때 — 전역 칸이 비었으면 옛 저장 값, 그것도 없으면 원본 0 초기값 */
function globalMatchSettingsOf(global: MatchProgressSettings | null, legacy: MatchProgressSettings | undefined): MatchProgressSettings {
  return global ?? legacy ?? SEASON_DEFAULT_MATCH_SETTINGS
}

/**
 * 시즌 경기진행 설정(전역 m = 1) — 전역 칸 손잡이가 있으면 그 값, 없거나 옛 저장이면 시즌 저장(또는 남겨 둔 덩어리)의 값.
 * 콜백(`optionsFor` · `startPendingGame`)은 지난 그림의 값을 읽는다 — 그림마다 `matchSettingsMirrorAtom` 상자에 적는다.
 */
export function useSeasonMatchSettings({ atoms, matchSettingsSeenSlot }: SeasonScope): MatchProgressSettings {
  const save = useSeasonValue(atoms, saveAtom)
  const carriedGlobals = useSeasonValue(atoms, carriedGlobalsAtom)
  const loadedSave = useSeasonValue(atoms, loadedSaveAtom)
  const globalMatchSettings = useSeasonValue(atoms, globalMatchSettingsAtom)
  const mirror = useSeasonValue(atoms, matchSettingsMirrorAtom)
  const seasonMatchSettings =
    matchSettingsSeenSlot?.readSeasonSettings === undefined
      ? ((save ?? carriedGlobals)?.matchSettings ?? SEASON_DEFAULT_MATCH_SETTINGS)
      : globalMatchSettingsOf(globalMatchSettings, (loadedSave ?? carriedGlobals)?.matchSettings)
  useMirrorRef(mirror, seasonMatchSettings)
  return seasonMatchSettings
}

/**
 * 옛 저장 이사 — 손잡이 칸이 비었고 시즌 저장(또는 남겨 둔 덩어리)에 값이 있으면 처음 한 번 전역 m = 1 칸으로 옮긴다(원본 자리).
 * 손잡이 · 옛 값은 첫 그림의 것으로 본다
 */
export function useMatchSettingsMigration({ atoms, matchSettingsSeenSlot }: SeasonScope): void {
  const loadedSave = useSeasonValue(atoms, loadedSaveAtom)
  const carriedGlobals = useSeasonValue(atoms, carriedGlobalsAtom)
  const mountedWith = useRef({ slot: matchSettingsSeenSlot, legacy: (loadedSave ?? carriedGlobals)?.matchSettings })
  useEffect(() => {
    const { slot, legacy } = mountedWith.current
    if (slot?.readSeasonSettings === undefined || slot.writeSeasonSettings === undefined) return
    if (slot.readSeasonSettings() !== null || legacy === undefined) return
    slot.writeSeasonSettings(legacy)
    atoms.set(globalMatchSettingsAtom, legacy)
  }, [atoms])
}
