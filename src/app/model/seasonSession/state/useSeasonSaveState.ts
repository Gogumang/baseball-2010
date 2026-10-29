import { useCallback, useRef, useState, useEffect } from 'react'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow'
import { type SeasonEntryRecordSource, seasonEntryOrderOf } from '@/entities/season-mode/model/seasonEntry'
import { seasonHallOfFameRecordSourceOf } from '@/app/model/seasonHallOfFameRecords'
import type { SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import type { MatchProgressSettings } from '@/features/play-team-game/model/matchSettings'
import { SEASON_DEFAULT_MATCH_SETTINGS } from '@/app/model/seasonSession/constants/seasonConstants'
import { type SeasonGlobalCarry, seasonGlobalCarryOf } from '@/app/model/seasonSession/save/globals'
import { normalizeSeasonSave, withSceneConstructed } from '@/app/model/seasonSession/save/normalize'
import type { SeasonSave } from '@/app/model/seasonSession/save/seasonSave'
import type { SeasonSessionArgs } from '@/app/model/seasonSession/hook/sessionArgs'
import { useMirrorRef } from '@/shared/lib/mirrorRef/useMirrorRef'

/** `useSeasonSession` 몸통 문장 0~13 을 그대로 옮겼다 (r346) — 부르는 차례 · 훅 차례는 `useSeasonSession` 그대로 */
export function useSeasonSaveState(ctx: SeasonSessionArgs) {
  const { gameSettingsNow, readHallOfFame, store, matchSettingsSeenSlot } = ctx
  /** 경기 옵션에 환경설정 세 칸을 싣는다 (`gameSettingsNow`) */
  const withGameSettings = useCallback(
    (options: TeamGameOptions): TeamGameOptions => (gameSettingsNow === undefined ? options : { ...options, ...gameSettingsNow() }),
    [gameSettingsNow],
  )
  /** 내 팀 명단 차례 — 영입한 명전 선수에게 기록을 싣는다 (7da5044 의 받는 쪽 `TeamEntryOrder.record`) */
  const recordSourceNow = useCallback((): SeasonEntryRecordSource | undefined => {
    const hallOfFame = readHallOfFame?.()
    return hallOfFame === undefined ? undefined : seasonHallOfFameRecordSourceOf(hallOfFame)
  }, [readHallOfFame])
  const entryOrderOf = useCallback((roster: SeasonTeamRoster) => seasonEntryOrderOf(roster, recordSourceNow()), [recordSourceNow])
  /** 들어올 때 올린 시즌 — 처음 한 번 */
  const [loadedSave] = useState(() => withSceneConstructed(normalizeSeasonSave(store.load() as Partial<SeasonSave> | null)))
  /**
   * 시즌이 없을 때의 전역 칸 (`SeasonGlobalCarry`) — 시즌이 있으면 그 저장이 주인이다. 그림은 상태를, 콜백은 ref 를 읽는다
   * (바꾸는 곳은 시즌 지우기 `resetSeason` 하나 — 둘을 같이 고친다)
   */
  const [carriedGlobals, setCarriedGlobals] = useState(() => seasonGlobalCarryOf(store.load()))
  const carriedGlobalsRef = useRef<SeasonGlobalCarry | null>(carriedGlobals)
  const [save, setSave] = useState<SeasonSave | null>(loadedSave)
  /**
   * 시즌 경기진행 설정(전역 m = 1) — 전역 칸 손잡이가 있으면 그 값, 없거나 옛 저장이면 시즌 저장(또는 남겨 둔 덩어리)의 값.
   * 옛 저장 이사: 손잡이 칸이 비었고 시즌 저장에 값이 있으면 처음 한 번 전역 칸으로 옮긴다(아래 effect)
   */
  const legacyMatchSettings = (loadedSave ?? carriedGlobals)?.matchSettings
  const [globalMatchSettings, setGlobalMatchSettings] = useState<MatchProgressSettings | null>(
    () => matchSettingsSeenSlot?.readSeasonSettings?.() ?? null,
  )
  const seasonMatchSettings =
    matchSettingsSeenSlot?.readSeasonSettings === undefined
      ? ((save ?? carriedGlobals)?.matchSettings ?? SEASON_DEFAULT_MATCH_SETTINGS)
      : (globalMatchSettings ?? legacyMatchSettings ?? SEASON_DEFAULT_MATCH_SETTINGS)
  const seasonMatchSettingsRef = useRef(seasonMatchSettings)
  useMirrorRef(seasonMatchSettingsRef, seasonMatchSettings)
  /** 첫 그림의 손잡이 · 옛 값 — 아래 처음 한 번 도는 이사가 읽는다 */
  const mountedWith = useRef({ slot: matchSettingsSeenSlot, legacy: legacyMatchSettings })
  useEffect(() => {
    const { slot, legacy } = mountedWith.current
    if (slot?.readSeasonSettings === undefined || slot.writeSeasonSettings === undefined) return
    if (slot.readSeasonSettings() !== null || legacy === undefined) return
    // 옛 저장 이사 — 시즌 저장이 들던 값을 전역 m = 1 칸으로 (원본 자리)
    slot.writeSeasonSettings(legacy)
    setGlobalMatchSettings(legacy)
    // 처음 한 번만 — 손잡이 · 옛 값은 첫 렌더의 것으로 본다
  }, [])
  return {
    withGameSettings,
    recordSourceNow,
    entryOrderOf,
    loadedSave,
    carriedGlobalsRef,
    setCarriedGlobals,
    save,
    setSave,
    setGlobalMatchSettings,
    seasonMatchSettings,
    seasonMatchSettingsRef,
  }
}

/** `useSeasonSaveState` 까지 선 값 */
export type SeasonSaveStateContext = SeasonSessionArgs & ReturnType<typeof useSeasonSaveState>
