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
  const loaded = useRef<SeasonSave | null>(null)
  if (loaded.current === null) loaded.current = withSceneConstructed(normalizeSeasonSave(store.load() as Partial<SeasonSave> | null))
  /** 시즌이 없을 때의 전역 칸 (`SeasonGlobalCarry`) — 시즌이 있으면 그 저장이 주인이다 */
  const carriedGlobals = useRef<SeasonGlobalCarry | null>(null)
  if (carriedGlobals.current === null) carriedGlobals.current = seasonGlobalCarryOf(store.load())
  const [save, setSave] = useState<SeasonSave | null>(loaded.current)
  /**
   * 시즌 경기진행 설정(전역 m = 1) — 전역 칸 손잡이가 있으면 그 값, 없거나 옛 저장이면 시즌 저장(또는 남겨 둔 덩어리)의 값.
   * 옛 저장 이사: 손잡이 칸이 비었고 시즌 저장에 값이 있으면 처음 한 번 전역 칸으로 옮긴다(아래 effect)
   */
  const legacyMatchSettings = (loaded.current ?? carriedGlobals.current)?.matchSettings
  const [globalMatchSettings, setGlobalMatchSettings] = useState<MatchProgressSettings | null>(
    () => matchSettingsSeenSlot?.readSeasonSettings?.() ?? null,
  )
  const seasonMatchSettings =
    matchSettingsSeenSlot?.readSeasonSettings === undefined
      ? ((save ?? carriedGlobals.current)?.matchSettings ?? SEASON_DEFAULT_MATCH_SETTINGS)
      : (globalMatchSettings ?? legacyMatchSettings ?? SEASON_DEFAULT_MATCH_SETTINGS)
  const seasonMatchSettingsRef = useRef(seasonMatchSettings)
  seasonMatchSettingsRef.current = seasonMatchSettings
  useEffect(() => {
    const slot = matchSettingsSeenSlot
    if (slot?.readSeasonSettings === undefined || slot.writeSeasonSettings === undefined) return
    if (slot.readSeasonSettings() !== null || legacyMatchSettings === undefined) return
    // 옛 저장 이사 — 시즌 저장이 들던 값을 전역 m = 1 칸으로 (원본 자리)
    slot.writeSeasonSettings(legacyMatchSettings)
    setGlobalMatchSettings(legacyMatchSettings)
    // 처음 한 번만 — 손잡이 · 옛 값은 첫 렌더의 것으로 본다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return {
    withGameSettings,
    recordSourceNow,
    entryOrderOf,
    loaded,
    carriedGlobals,
    save,
    setSave,
    setGlobalMatchSettings,
    seasonMatchSettings,
    seasonMatchSettingsRef,
  }
}

/** `useSeasonSaveState` 까지 선 값 */
export type SeasonSaveStateContext = SeasonSessionArgs & ReturnType<typeof useSeasonSaveState>
