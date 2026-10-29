import { leagueDayCounterOf } from '@/entities/career/model/leagueGameSetup'
import { humanGamePitcherOrderOf, humanGamePitcherStaminasOf } from '@/entities/pitcher-career/model/leaguePitcherRecords'
import { FULL_STAMINA } from '@/entities/pitcher-career/model/pitcherStamina'
import { PITCHER_EDITION_MODE } from '@/entities/pitcher-career/model/pitcherRotation'
import {
  gameMyPitcherOrderOf,
  legacyMyPitcherOrderOf,
  myPitcherPositionCodeOf,
  prepareMyPitcherOrder,
  recordedMyPitcherOrderOf,
  withMyPitcherOrder,
} from '@/entities/pitcher-career/model/myPitcherRecord'
import type { MyPitcherDay } from '@/entities/pitcher-career/model/myPitcherRecord'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer/types/pitcherCareer'

/**
 * 오늘 경기 준비의 내 팀 몫 — 날짜 g · 보직. 0xa4f60 의 −2 는 국가대항전(S+0x12c)일 때만이라 리그 경기(포스트시즌 포함)는 거짓 —
 * 국가대항전 경기는 대표팀 칸을 따로 준비한다(`pitcherCupTeams`).
 */
function myPitcherDayOf(career: PitcherCareer): MyPitcherDay {
  return { dayCounter: leagueDayCounterOf(career), role: career.role, isNationalCup: false }
}

/**
 * 오늘 경기의 내 팀 투수 배열 — 142 진입(`prepareMyPitcherMatch`)이 넣은 레코드 그대로. 레코드에 배열이 없는 옛 저장(142 를 안
 * 거치고 곧장 경기로 가는 이어하기)은 예전 날짜 셈으로 오늘 준비까지 밟은 배열.
 */
export function todayMyPitcherOrderOf(career: PitcherCareer): readonly number[] {
  return recordedMyPitcherOrderOf(career) ?? legacyMyPitcherOrderOf(myPitcherDayOf(career), true)
}

/**
 * **142 진입 0x1c46c 의 내 팀 몫** — 마선수 넣기와 같은 문(장면+0x288 · 이전 상태 143) 안에서 한 번: 내 팀 투수 배열을 오늘
 * 준비대로 고치고(`prepareMyPitcherOrder`), 포지션 코드를 새 칸으로(0xb8768), g == 0 이면 내 +0x2c = 10000(0x1c8a8).
 */
export function prepareMyPitcherMatch(career: PitcherCareer): PitcherCareer {
  const day = myPitcherDayOf(career)
  const before = recordedMyPitcherOrderOf(career) ?? legacyMyPitcherOrderOf(day, false)
  const order = prepareMyPitcherOrder(before, day)
  return {
    ...career,
    nariTeams: withMyPitcherOrder(career, order),
    positionCode: myPitcherPositionCodeOf(order),
    ...(day.dayCounter === 0 ? { stamina: FULL_STAMINA } : {}),
  }
}

/**
 * 사람 경기 준비 `0x1c46c` 가 세운 투수 — 상대 팀 레코드 차례(0번 선발 · 벤치 차례)와 양 팀 칸별 `+0x2c`.
 * `PitcherGameOptions` 에 그대로 얹는다. 내 팀 차례는 진행기가 0xa4f60 맞바꿈으로 세운다.
 */
export function pitcherLeagueGameSetupOf(
  career: PitcherCareer,
  opponentTeamId: number,
): {
  readonly opponentPitcherOrder: readonly number[]
  /** 내 팀 투수 배열 — 진행기 칸 번호(내 투수 = 표 밖 8). 142 진입이 오늘 준비를 레코드에 넣은 뒤의 차례 (`myPitcherRecord`) */
  readonly ourPitcherOrder: readonly number[]
  /** 내 투수 포지션 코드 `0xb6394` = 그 배열 안 내 칸 (116 평가의 ≤3 선발형 판정) */
  readonly positionCode: number
  /** g == 0 이면 0x1c8a8 이 내 팀 레코드도 10000 으로 채운다 — 내 투수 +0x2c */
  readonly stamina?: number
  readonly ourPitcherStaminas?: readonly number[]
  readonly opponentPitcherStaminas?: readonly number[]
} {
  const day = leagueDayCounterOf(career)
  const ourPitcherStaminas = humanGamePitcherStaminasOf(career, day, career.teamId)
  const opponentPitcherStaminas = humanGamePitcherStaminasOf(career, day, opponentTeamId)
  const order = todayMyPitcherOrderOf(career)
  return {
    opponentPitcherOrder: humanGamePitcherOrderOf(career, PITCHER_EDITION_MODE, day, opponentTeamId),
    ourPitcherOrder: gameMyPitcherOrderOf(order),
    positionCode: myPitcherPositionCodeOf(order),
    ...(day === 0 ? { stamina: FULL_STAMINA } : {}),
    ...(ourPitcherStaminas === undefined ? {} : { ourPitcherStaminas }),
    ...(opponentPitcherStaminas === undefined ? {} : { opponentPitcherStaminas }),
  }
}
