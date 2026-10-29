import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { pitcherLeagueGameSetupOf } from '@/entities/pitcher-career/model/pitcherCareer'
import { nationalCupSideOf, type NationalCup, type NationalCupMatchup } from '@/entities/national-cup/model/nationalCup'
import { nariCupRecordOf, type NariCupTeams } from '@/entities/career/model/nariCupTeams'
import { createPitcherCupTeams, pitcherCupPositionCodeOf } from '@/entities/pitcher-career/model/pitcherCupTeams'
import { gameMyPitcherOrderOf } from '@/entities/pitcher-career/model/myPitcherRecord'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import type { PlayerSide } from '@/entities/game/model/gameState'
import { nariTeamRecordOf, nariTeamsOf, recordMatchAcesOf, recordTeamAcesOf } from '@/entities/career/model/nariTeamRecord'
import { pitcherGameOptionsOf } from '@/pages/pitcher-league/model/pitcherGameOptions'
import type { PitcherGameOptions } from '@/features/play-pitcher-game/model/pitcherGameFlow'

/** 화면 쪽 경기 설정 — 게이지 · 송구 (`pitcherGameOptionsOf` 의 둘째 인자) */
export type PitcherGameSettings = Parameters<typeof pitcherGameOptionsOf>[1]

/**
 * 리그 경기 옵션 — 화면 쪽 옵션(`pitcherGameOptionsOf`)에 경기 준비 0x1c46c 가 세운 리그 투수를 얹는다:
 * 상대 팀 레코드 차례(g ≠ 0 이면 한 칸 돈 것 · 포스트시즌은 시리즈 이월)와 양 팀 칸별 +0x2c (`pitcherLeagueGameSetupOf`).
 */
function leagueGameOptionsOf(career: PitcherCareer, settings: PitcherGameSettings): PitcherGameOptions {
  const options = pitcherGameOptionsOf(career, settings)
  return { ...options, ...pitcherLeagueGameSetupOf(career, options.opponentTeamId) }
}

/** 저장의 국가대항전 대회 레코드 두 칸 — 없으면(대회 중 옛 저장) 대회 초기화 꼴로 세운다 */
export function pitcherCupTeamsOf(career: PitcherCareer, opponentTeamId: number): NariCupTeams {
  return career.nariCupTeams ?? createPitcherCupTeams(career.positionCode, opponentTeamId)
}

/**
 * **국가대항전 경기 옵션** — 경기 장면 0xb891c 가 대회 레코드 두 칸(0x1f940: S+0x12c 면 팀 10 → +0xbc4, 그 밖 → +0xbe0)으로 선다.
 * 내 팀 = 대표팀(10) · 측 = 0xb7844 의 L+0xac 갈래(대진 칸 0 이 후공, `nationalCupSideOf`) · g = 대회 날짜 L+0x32 ·
 * 대표팀 투수 배열(내 투수 복사본 — 포지션 코드는 그 칸) · 스태미나는 날마다 10000(0xb6190, 복사본 포함) · 두 팀 사기 = 상대국 칸 +2(`nariMoraleOf`) ·
 * 마선수 없음(1c5fe) · 0xa56dc 는 S+0x12c 라 거짓(기록 안 셈).
 */
export function cupGameOptionsOf(
  career: PitcherCareer,
  matchup: NationalCupMatchup,
  cup: NationalCup,
  settings: PitcherGameSettings,
): PitcherGameOptions {
  const teams = pitcherCupTeamsOf(career, matchup.opponent)
  const options = pitcherGameOptionsOf(career, {
    ...settings,
    opponentTeamId: matchup.opponent,
    playerSide: nationalCupSideOf(cup, matchup.myTeam) as PlayerSide,
    // 팀 사기는 넘기지 않는다 — 두 팀 레코드 +2 는 셋업 3a332 · 0xb570c b5768 이 0xa3a24 로 덮고, 대회 중 0xa3a24 는 상대국 칸 +2 를
    // 읽는다(원본 버그). `pitcherGameOptionsOf` 의 기본값 `nariMoraleOf` 가 그 값이고 내 능력치의 사기 감소도 같은 값이다
  })
  return {
    ...options,
    ourTeamId: matchup.myTeam,
    dayCounter: cup.day,
    isPostseason: false,
    isNationalCup: true,
    // L+0xad — 0x39fdc 모드 3 갈래의 구장 2(풀리그) · 8(결승)
    nationalCupStage: cup.stage,
    positionCode: pitcherCupPositionCodeOf(teams),
    stamina: FULL_STAMINA,
    ourPitcherOrder: gameMyPitcherOrderOf(teams.korea.pitchers ?? []),
    opponentPitcherOrder: nariCupRecordOf(teams, matchup.opponent).pitchers,
    isRivalGame: false,
  }
}

/**
 * 경기 장면 0x39fdc 모드 3 갈래가 세울 경기 — 두 팀은 저장의 나리 팀 레코드로 선다: 142 진입 0x1c46c 가 넣은 마선수는 두 팀
 * 레코드의 9번(마타자)·8번(마투수) 칸이다. 타자 배열은 붙박이 + 마타자라 진행기가 세우는 명단(`withAceBatterLineup`)과 같다
 */
export function recordGameOptionsOf(
  current: PitcherCareer,
  settings: PitcherGameSettings,
  aceLevels: Readonly<Record<number, number>> | undefined,
): PitcherGameOptions {
  const options = leagueGameOptionsOf(current, settings)
  const records = nariTeamsOf(current)
  const recordAces = recordMatchAcesOf(records, current.teamId, options.opponentTeamId)
  if (recordAces === null) return options
  return {
    ...options,
    aces: {
      ours: recordTeamAcesOf(nariTeamRecordOf(records, current.teamId)),
      opponent: recordTeamAcesOf(nariTeamRecordOf(records, options.opponentTeamId)),
      ...(aceLevels === undefined ? {} : { levels: aceLevels }),
    },
  }
}
