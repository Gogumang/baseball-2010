import {
  MY_PITCHER_SLOT, OUR_ACE_PITCHER_SLOT, opponentPitcherOrderOf, ourPitcherOrderOf,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { PitcherGameOptions } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { NO_RECORD_ACE, nariTeamRecordOf, nariTeamsOf } from '@/entities/career/model/nariTeamRecord'
import { ACE_PITCHER_SLOT } from '@/entities/league/model/leagueDay'
import {
  acePitcherFace, nariEntryBattersOf, nariEntryPitchersOf, openNariEntryView,
} from '@/pages/management/lib/nariEntryView'
import type { NariEntryView } from '@/pages/management/lib/nariEntryView'

/**
 * **투수편** 143 경기 전 엔트리 보기 (진입 0x16af8 — 타자편과 같은 장면 0x106 함수, `pages/management/lib/nariEntryView`).
 * 타자 탭은 저장의 나리 팀 레코드(붙박이 + 142 마타자), 투수 탭은 경기를 세울 옵션(`options` — 레코드의 마선수가 실린 것)으로
 * 진행기가 세우는 차례다: 내 팀 `ourPitcherOrderOf`(레코드 투수 배열 — 내 투수 줄 · 마투수 칸 포함) · 상대 `opponentPitcherOrderOf`.
 */
export function pitcherNariEntryViewOf(
  career: PitcherCareer,
  options: PitcherGameOptions,
  isMyTeam: boolean,
): NariEntryView {
  const teamId = isMyTeam ? options.ourTeamId : options.opponentTeamId
  const record = nariTeamRecordOf(nariTeamsOf(career), teamId)
  const order = isMyTeam ? ourPitcherOrderOf(options) : opponentPitcherOrderOf(options)
  const aceSlot = isMyTeam ? OUR_ACE_PITCHER_SLOT : ACE_PITCHER_SLOT
  return openNariEntryView(isMyTeam, teamId, {
    batters: nariEntryBattersOf(record, teamId, null),
    pitchers: nariEntryPitchersOf(teamId, order, (slot) => {
      if (isMyTeam && slot === MY_PITCHER_SLOT) {
        const { control, velocity, breaking, stamina } = career.ability
        return { name: career.name, ability: [control, velocity, breaking, stamina], isAce: false }
      }
      if (slot === aceSlot && record.acePitcher !== NO_RECORD_ACE) return { ...acePitcherFace(record.acePitcher), isAce: true }
      return undefined
    }),
  })
}
