import { useCallback } from 'react'
import type { TeamGameOptions } from '@/features/play-team-game/model/teamGameFlow'
import { type SeasonEntryRecordSource, seasonEntryOrderOf } from '@/entities/season-mode/model/seasonEntry'
import { seasonHallOfFameRecordSourceOf } from '@/app/model/seasonHallOfFameRecords'
import type { SeasonTeamRoster } from '@/entities/season-mode/model/playerRecruit'
import type { SeasonScope } from '@/app/model/seasonSession/atoms/seasonScope'

/** 경기를 세울 때 앱에서 읽는 것 — 환경설정 세 칸 · 명전 기록 (세션 매개변수만 본다) */
export function useSeasonGameSetup({ gameSettingsNow, readHallOfFame }: SeasonScope) {
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
  return { withGameSettings, recordSourceNow, entryOrderOf }
}
