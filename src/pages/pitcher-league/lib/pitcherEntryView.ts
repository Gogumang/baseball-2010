import {
  MY_PITCHER_SLOT, OUR_ACE_PITCHER_SLOT, opponentPitcherOrderOf, ourPitcherOrderOf,
} from '@/features/play-pitcher-game/model/pitcherGameFlow'
import type { PitcherGameOptions } from '@/features/play-pitcher-game/model/pitcherGameFlow'
import { equippedPitcherAbilityOf, pitcherFormOfCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { seasonRecordProfileOf } from '@/entities/season-mode/model/seasonEntry'
import { skillBitsOfIds } from '@/entities/team/model/recordAbility'
import { NO_RECORD_ACE, nariTeamRecordOf, nariTeamsOf } from '@/entities/career/model/nariTeamRecord'
import { nariCupRecordOf } from '@/entities/career/model/nariCupTeams'
import type { NariCupTeams } from '@/entities/career/model/nariCupTeams'
import type { NariEntryFace } from '@/pages/management/lib/nariEntryView'
import { ACE_PITCHER_SLOT } from '@/entities/league/model/leagueDay'
import {
  acePitcherFace, nariEntryBattersOf, nariEntryPitchersOf, nariEntryTeamMoraleOf, openNariEntryView,
} from '@/pages/management/lib/nariEntryView'
import type { NariEntryCellSource, NariEntryView } from '@/pages/management/lib/nariEntryView'
import { ACE_PITCHERS } from '@/entities/game/model/aceOpponent'
import { humanGamePitcherStaminasOf } from '@/entities/pitcher-career/model/leaguePitcherRecords'
import { PITCHER_EDITION_MODE } from '@/entities/pitcher-career/model/pitcherRotation'

/**
 * **투수편** 143 경기 전 엔트리 보기 (진입 0x16af8 — 타자편과 같은 장면 0x106 함수, `pages/management/lib/nariEntryView`).
 * 타자 탭은 저장의 나리 팀 레코드(붙박이 + 142 마타자), 투수 탭은 경기를 세울 옵션(`options` — 레코드의 마선수가 실린 것)으로
 * 진행기가 세우는 차례다: 내 팀 `ourPitcherOrderOf`(레코드 투수 배열 — 내 투수 줄 · 마투수 칸 포함) · 상대 `opponentPitcherOrderOf`.
 * 국가대항전(`cupTeams`)이면 0x1f9a9 → 0x1f940 이 S+0x12c 동안 대회 레코드 두 칸(+0xbc4 대표팀 · +0xbe0 상대국)을 준다.
 */
export function pitcherNariEntryViewOf(
  career: PitcherCareer,
  options: PitcherGameOptions,
  isMyTeam: boolean,
  cupTeams?: NariCupTeams,
): NariEntryView {
  const teamId = isMyTeam ? options.ourTeamId : options.opponentTeamId
  const record = cupTeams === undefined ? nariTeamRecordOf(nariTeamsOf(career), teamId) : nariCupRecordOf(cupTeams, teamId)
  const order = isMyTeam ? ourPitcherOrderOf(options) : opponentPitcherOrderOf(options)
  const aceSlot = isMyTeam ? OUR_ACE_PITCHER_SLOT : ACE_PITCHER_SLOT
  // 기록 열 · 체력 줄 — [ed+0x334] = 3 (`NariEntryCellSource`). 국가대항전 칸은 비운다(⚠️ 그 주석)
  const cells: NariEntryCellSource | undefined = cupTeams !== undefined ? undefined : {
    stats: career.leaguePlayerStats,
    staminas: humanGamePitcherStaminasOf(career, options.dayCounter, teamId),
    staminaMode: PITCHER_EDITION_MODE,
    // 팀 레코드 +2 — 내 팀은 커리어 사기(0x1f988 +2), 상대는 그 팀이 마지막으로 선 경기 때의 나리 사기 (`teamRecordMorales`, r128)
    morale: nariEntryTeamMoraleOf(career, isMyTeam, teamId),
  }
  return openNariEntryView(isMyTeam, teamId, {
    batters: nariEntryBattersOf(record, teamId, null, cells),
    pitchers: nariEntryPitchersOf(teamId, order, (slot) => {
      if (isMyTeam && slot === MY_PITCHER_SLOT) return { ...myPitcherEntryFaceOf(career), isAce: false }
      if (slot === aceSlot && record.acePitcher !== NO_RECORD_ACE) return { ...acePitcherFace(record.acePitcher), isAce: true }
      return undefined
    }, cells, (slot) => (slot === aceSlot && record.acePitcher !== NO_RECORD_ACE ? ACE_PITCHERS[record.acePitcher]?.recordLine ?? [] : undefined),
    // 레코드 투수 장비 니블 (나리 새 시즌 CPU 장비 굴림 0x665e8) — 상세 창 도형 값이 그 보너스를 먹는다
    record.pitcherEquipment),
  })
}

/**
 * **투수편 내 투수 줄** — 나리 팀 레코드의 내 칸은 커리어 0x30 바이트 레코드다(시즌 영입 사본 `seasonNariPitcherRecordOf` 와 같은 칸).
 * 0x5b798 투수 갈래(5bf64~)가 읽는 것: 도형 0xb6414(rec, k, 1) = 장비 · 장착 스킬을 얹은 값(`equippedPitcherAbilityOf`) ·
 * 폼 +0xb >> 4(타입 · 손) · +0x1c 구질 마스크 · +0x14 장착 스킬 비트 · +0x18 고른 마구 · 연봉 — 육성(0xb6388)이고 모드 3 · 4 라
 * 저장 +0x1c8 × 100 (5c848~5c872). 보직 딱지 +0xb & 3 = 보직
 */
export function myPitcherEntryFaceOf(career: PitcherCareer): NariEntryFace {
  const equipped = equippedPitcherAbilityOf(career)
  const ability = [equipped.control, equipped.velocity, equipped.breaking, equipped.stamina]
  const profile = seasonRecordProfileOf(career.typeIndex, career.handIndex, career.skinIndex, career.role)
  return {
    name: career.name,
    ability,
    profileLow: profile & 3,
    detailSource: {
      isPitcher: true, abilities: ability, aceIndex: -1, profile, skillBits: skillBitsOfIds(career.equippedSkillIds),
      repertoire: { form: pitcherFormOfCareer(career), magicNumber: career.selectedMagicNumber, pitchMask: career.pitchMask },
      grade: null, nurturedSalary: career.salary,
    },
  }
}
