import { NO_RECORD_ACE, nariTeamRecordOf, nariTeamsOf, tableNariTeamRecord } from '@/entities/career/model/nariTeamRecord'
import type { NariTeamRecord } from '@/entities/career/model/nariTeamRecord'
import { leagueGamePitchersOf, nextOpponentOf } from '@/entities/career/model/playerCareer'
import type { PlayerCareer } from '@/entities/career/model/playerCareer'
import { nariCupRecordOf } from '@/entities/career/model/nariCupTeams'
import { ACE_PITCHER_SLOT } from '@/entities/league/model/leagueDay'
import { UNSHUFFLED_PITCHER_ORDER } from '@/entities/league/model/league'
import { ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { BATTER_EDITION_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import { humanGamePitcherStaminasOf } from '@/entities/pitcher-career/model/leaguePitcherRecords'
import { leagueDayCounterOf } from '@/entities/career/model/leagueGameSetup'
import { nariCupEntryCellSourceOf, nariEntryTeamMoraleOf } from './cupCells'
import { acePitcherFace, nariEntryBattersOf, nariEntryPitchersOf } from './entryRows'
import { openNariEntryView } from './editorView'
import { myBatterEntryFaceOf, myBatterEntryLineOf } from './myBatterRow'
import type { NariEntryCellSource, NariEntryFace, NariEntryView } from './types'

type CupPair = { readonly myTeam: number; readonly opponent: number }

/** 레코드 8번 칸 마투수를 투수 차례 끝(8번)에 — `0xb521c` 의 0x60 갈래 */
function withRecordAcePitcher(order: readonly number[], record: NariTeamRecord): readonly number[] {
  return record.acePitcher === NO_RECORD_ACE ? order : [...order, ACE_PITCHER_SLOT]
}

/** 표 밖 투수 칸 — 마투수 */
function recordAcePitcherSpecial(record: NariTeamRecord) {
  return (slot: number) =>
    slot === ACE_PITCHER_SLOT && record.acePitcher !== NO_RECORD_ACE ? { ...acePitcherFace(record.acePitcher), isAce: true } : undefined
}

/** 표 밖 투수 칸 — 마투수 레코드 줄 */
export function recordAcePitcherLineOf(record: NariTeamRecord) {
  return (slot: number) =>
    slot === ACE_PITCHER_SLOT && record.acePitcher !== NO_RECORD_ACE ? (ACE_PITCHERS[record.acePitcher]?.recordLine ?? []) : undefined
}

/**
 * 국가대항전 — 0x1f9a9 가 팀 10 은 대표팀 칸(+0xbc4, 내 선수가 낀), 그 밖은 상대국 칸(+0xbe0)을 준다. 투수는 142 가 돌린 그 칸 차례.
 * 기록 열 — 붙박이 줄은 마스터 복사(Xls 행) 줄, 내 선수 줄은 상태 133 의 0xb53f1 이 0x1fc21(g) 내 레코드 0x30 바이트를 그대로
 * memcpy(b54f6 · 0x1400418)한 것이라 커리어 시즌 줄이다(대회 경기는 게이트 0xa56dc 가 거짓이라 그 뒤로 안 바뀐다)
 */
function cupBatterEntryViewOf(career: PlayerCareer, isMyTeam: boolean, cup: CupPair, me: NariEntryFace): NariEntryView {
  const teamId = isMyTeam ? cup.myTeam : cup.opponent
  const record = career.nariCupTeams === undefined ? tableNariTeamRecord(teamId) : nariCupRecordOf(career.nariCupTeams, teamId)
  const cells = nariCupEntryCellSourceOf(career.leaguePlayerStats, BATTER_EDITION_MODE, teamId, career.nariCupTeams)
  return openNariEntryView(isMyTeam, teamId, {
    batters: nariEntryBattersOf(record, teamId, { ...me, batterLine: myBatterEntryLineOf(career) }, cells),
    pitchers: nariEntryPitchersOf(teamId, record.pitchers ?? UNSHUFFLED_PITCHER_ORDER, undefined, cells),
  })
}

/**
 * **타자편** 143 — 정규·포스트시즌은 저장의 나리 팀 레코드(`nariTeams`)와 142 진입이 돌린 투수 차례(`leagueGamePitchersOf` —
 * g ≠ 0 이면 0xb8c80 로 한 칸 돈 것 · 포스트시즌은 시리즈 이월), 국가대항전(`cup`)은 대회 레코드 두 칸이다.
 */
export function batterNariEntryViewOf(career: PlayerCareer, isMyTeam: boolean, cup?: CupPair): NariEntryView {
  const face = myBatterEntryFaceOf(career)
  if (cup !== undefined) return cupBatterEntryViewOf(career, isMyTeam, cup, face)
  const opponent = nextOpponentOf(career)
  const teamId = isMyTeam ? career.teamId : opponent
  const record = nariTeamRecordOf(nariTeamsOf(career), teamId)
  const pitchers = leagueGamePitchersOf(career, opponent)
  // 내 선수 줄의 기록 열 — 레코드 +0x20~ 는 커리어 시즌 줄이다(`myBatterEntryLineOf`). 표 밖 줄이라 내 팀 탭에만 선다
  const me: NariEntryFace = { ...face, batterLine: myBatterEntryLineOf(career) }
  const cells: NariEntryCellSource = {
    stats: career.leaguePlayerStats,
    staminas: humanGamePitcherStaminasOf(career, leagueDayCounterOf(career), teamId),
    staminaMode: BATTER_EDITION_MODE,
    // 팀 레코드 +2 — 내 팀은 0xa3a24 가 읽는 그 칸(커리어 사기), 상대는 그 팀이 마지막으로 선 경기 때의 나리 사기 (r128)
    morale: nariEntryTeamMoraleOf(career, isMyTeam, teamId),
  }
  return openNariEntryView(isMyTeam, teamId, {
    batters: nariEntryBattersOf(record, teamId, me, cells),
    pitchers: nariEntryPitchersOf(
      teamId,
      withRecordAcePitcher(isMyTeam ? pitchers.ourOrder : pitchers.opponentOrder, record),
      recordAcePitcherSpecial(record),
      cells,
      recordAcePitcherLineOf(record),
      record.pitcherEquipment,
    ),
  })
}
