import {
  insertMyBatter,
  myBatterIndexOf,
  nariTeamRecordOf,
  nariTeamsOf,
  tableNariTeamRecord,
} from '@/entities/career/model/nariTeamRecord'
import type { NariTeamRecord, NariTeamRecordFields } from '@/entities/career/model/nariTeamRecord'
import { LEAGUE_TEAM_COUNT, UNSHUFFLED_PITCHER_ORDER } from '@/entities/league/model/league'
import { advanceRotation } from '@/entities/pitcher-career/model/pitcherRotation'

/**
 * **나리 국가대항전 대회 레코드 두 칸** — 저장 블록 `[저장+0xbc]`(타자편)의 **+0xbc4 대표팀** · **+0xbe0 상대국** (시즌모드는 같은 꼴로
 * `[저장+0xb4]` 의 +0x918 · +0x934). 저장 크기 0x1fdf4 가 열 팀 뒤에 두 칸을 더해 저장에 들어간다. 직접 떴다:
 * ```
 * 0x1f8f8(저장, 팀)   모드 4 레코드: S+0x12c(국가대항전) ≠ 0 이면 팀 10 → +0xbc4, 그 밖 팀 → **모두 +0xbe0** · 아니면 +4 + 0x1c·팀
 * 0xb7bf0(L)          대회 초기화 — 0x205c1(g, 모드): +0xbc4 를 지우고 마스터 팀 10 을 깊은 복사(0x1fe5c) · 0xb6191 대한민국 투수 10000 ·
 *                     0x20649(g, 모드, 첫날 사람 경기 상대 0xb7614(L, 4, 1)): +0xbe0 에 마스터 그 팀을 복사
 * 상태 133 0x1a090    출전 갈래: 0xb7bf1 뒤 0xb53f1(대표팀, 0x1fc21(g) 내 선수, 1) — 0x80 갈래라 내 칸 t(+0xa, 나리 팀에서 다시 매긴
 *                     첨자 = 타순 − 1)의 선수를 위치 0 으로 맨 끝 벤치에, 칸 t 에 내 선수 (`insertMyBatter`) · 0x1faa1(g, 0, 1) · 저장
 * 142 진입 0x1c46c    같은 문(장면+0x288) 안 1c574: g = L+0x32(대회 날짜) ≠ 0 이면 상대 0xb8c80 · 모드 4 내 팀 0xb8c80 — 두 칸 다 0~3 을
 *                     제자리에서 한 칸 돌린다. 1c5fe: S+0x12c 면 마선수를 안 넣는다
 * 하루 끝 0xb818c     국가대항전 갈래 b81e0 대한민국 투수 10000 · b8216 0x20649 로 다음 날 상대를 +0xbe0 에 새로 복사
 * ```
 * 대표팀 칸은 대회 내내 이어지고(내 선수 · 투수 차례), 상대국 칸은 날마다 마스터에서 다시 선다. 경기는 0xb891c 가 이 두 칸으로 팀을
 * 세우고(타순 = 타자 배열 차례 · 선발 = 투수 0번), 143 엔트리 보기(0x1f9a9)도 이 두 칸을 보인다.
 * 경기 장면 0x39fdc(직접 떴다): 3a0f0~3a162 가 S+0x12c 면 두 팀 = 0xb7614(L, L+0xad, 0/1), 팀 10 을 우리 쪽에 두고(3a148),
 * 3a2cc · 3a2f4 의 0xb891c(모드 4) → 0xb8680 점프표 0xd8a30 → 0x1f989 → 0x1f8f8 이 팀 10 을 +0xbc4 로 읽는다. 3a2fa 0xb8768 이
 * 두 팀을 배열 첨자로 다시 매겨 내 레코드 칸 0xb6394 = 대표팀 안 내 첨자(`nariCupBattingOrderOf` − 1), 동료도 첨자다
 * (`nariQuickLineupOf` 의 `recordSlots`).
 */
export interface NariCupTeams {
  /** +0xbc4 대표팀(팀 10) — 내 선수가 낀 타자 배열 · 투수 차례(`pitchers`) */
  readonly korea: NariTeamRecord
  /** +0xbe0 상대국 — 그날 사람 경기 상대의 마스터 복사 */
  readonly opponent: NariTeamRecord
  /** 상대국 칸이 든 팀 번호 (11~13) */
  readonly opponentTeamId: number
  /**
   * **상대국 칸 +2 (팀 사기)** — 마스터 복사(`0x20648` → `0x1fe5c`)라 처음엔 그 팀 표값(`teamRecordMoraleOf`, 전 팀 100)이고, 없으면 그 값이다.
   * ⚠️ 원본 버그로 대회 중 나리 사기 읽기 · 쓰기 `0xa3a24` · `0xa3a44` 가 이 칸을 쓴다(`entities/career/model/nariMorale`) — 대회 중
   * 돌발 보상 사기(0x8e34c)가 여기 쌓이고, 하루 끝 b8216 의 새 복사가 지운다(`nextNariCupDayTeams`)
   */
  readonly opponentMorale?: number
  /**
   * **대표팀 칸 +2 (팀 사기)** — 마스터 복사라 처음엔 팀 10 표값이고, 대회 사람 경기가 덮는다: 경기 셋업 0x39fdc 3a31e 가
   * `0xa3a25(0x1f8d5(g, 모드))` 를 0..100 으로 잘라 `strh [팀+2]`, 실효 능력치 0xb570c 모드 3·4 갈래 b5762~b576a 가 공마다 넘겨 받은
   * 두 팀 레코드 +2 에 같은 `0xa3a25` 를 쓴다. 대회 중 `0xa3a25` 는 상대국 칸 +2 를 읽으니(원본 버그, `nariMorale`) 대표팀 칸에는
   * **경기 끝 무렵의 상대국 칸 사기**가 남고, 대표팀 칸은 하루 끝(b8216 은 상대국 칸만 새로 복사)에도 안 지워진다. 없으면 표값
   */
  readonly koreaMorale?: number
  /**
   * **대표팀 타자 칸별 +0x2e 실책** (붙박이 칸 → 쌓인 수) — 수비 그림 0x43278 4381a~43904 가 펌블 6 · 악송구 4 를 본 야수 레코드(+0xec)에
   * 게이트 없이 +1(0~9999) 한다. 대회 사람 경기의 그 레코드는 대표팀 칸(+0xbc4) 복사본이라 거기 쌓인다 — 투수편에서 사람이 수비할 때.
   * (타자편은 수비 그림이 상대 야수만이라 상대국 칸에 쌓이고, 그 칸은 하루 끝 b8216 이 새로 복사해 지운다.) 마스터 행 +0x2e 는 0
   */
  readonly koreaErrors?: Readonly<Record<number, number>>
  /**
   * **투수편 대표팀 칸 안 내 투수 +0x2a 에 대회 중 더해진 사사구** — 정산 0xa8024 꼬리 a8b04~a8bee 는 게이트 0xa56dc 밖이라 볼넷 · 사구마다
   * 지금 마운드 투수 레코드(0xae83c)에 +1(0~9999). 대회 중 그 레코드는 133 이 내 레코드 0x30 바이트를 베낀 대표팀 칸 사본이라 거기 쌓이고
   * 내 원래 레코드(커리어 시즌 줄)는 그대로다
   */
  readonly myCupWalks?: number
}

/** 대표팀 팀 번호 */
const KOREA_TEAM = 10

/** 마스터 복사 — 붙박이 표 그대로 · 투수 차례 [0..7] */
function masterCupRecordOf(teamId: number): NariTeamRecord {
  return { ...tableNariTeamRecord(teamId), pitchers: UNSHUFFLED_PITCHER_ORDER }
}

/** 대회 초기화 0xb7bf0 + 상태 133 의 내 선수 넣기 — `myBatterSlot` 은 나리 팀에서의 내 칸(타순 − 1) */
export function createNariCupTeams(myBatterSlot: number, firstOpponentTeamId: number): NariCupTeams {
  return {
    korea: insertMyBatter(masterCupRecordOf(KOREA_TEAM), myBatterSlot),
    opponent: masterCupRecordOf(firstOpponentTeamId),
    opponentTeamId: firstOpponentTeamId,
  }
}

/** 142 진입(1c574) — 대회 날짜 g ≠ 0 이면 두 칸의 투수 0~3 을 한 칸씩 돌린다(영구) */
export function prepareNariCupMatch(teams: NariCupTeams, cupDay: number): NariCupTeams {
  if (cupDay === 0) return teams
  const rotate = (record: NariTeamRecord): NariTeamRecord => ({
    ...record,
    pitchers: advanceRotation(record.pitchers ?? UNSHUFFLED_PITCHER_ORDER),
  })
  return { ...teams, korea: rotate(teams.korea), opponent: rotate(teams.opponent) }
}

/**
 * 하루 끝 b8216 — 다음 날 사람 경기 상대를 마스터에서 새로 복사(+2 사기도 표값으로 — `opponentMorale` 를 뺀다).
 * 대회가 끝나 상대가 없으면 그대로
 */
export function nextNariCupDayTeams(teams: NariCupTeams, nextOpponentTeamId: number | null): NariCupTeams {
  if (nextOpponentTeamId === null) return teams
  // 대표팀 칸(+0xbc4)과 거기 쌓인 사기 · 실책 · 사사구는 그대로 — 상대국 칸만 새로 선다
  const next: NariCupTeams = { ...teams, opponent: masterCupRecordOf(nextOpponentTeamId), opponentTeamId: nextOpponentTeamId }
  delete (next as { opponentMorale?: number }).opponentMorale
  return next
}

/** a8b5a · 0x43838 의 `0x270f` 상한 */
const CUP_RECORD_COUNTER_LIMIT = 9999

/** 대회 사람 경기 하나가 대표팀 칸에 남긴 것 (`recordNariCupGame`) */
export interface NariCupGameMarks {
  /** 경기 끝 무렵 0xb570c 가 대표팀 칸 +2 에 마지막으로 쓴 나리 사기 (대회 중이라 상대국 칸 +2 값) */
  readonly morale?: number
  /** 수비 그림 0x43278 이 올린 실책 — 대표팀(팀 10) 것만 쓴다 */
  readonly errors?: readonly { readonly teamId: number; readonly battingOrderIndex: number }[]
  /** 투수편 — 내 투수가 낸 사사구 (a8b04~a8bee) */
  readonly myWalks?: number
}

/**
 * 대회 사람 경기가 **대표팀 칸**(+0xbc4)에 남기는 것을 얹는다 — 하루 끝 상대국 새 복사(`nextNariCupDayTeams`)보다 먼저 부른다.
 * 대회 정산 0xa8024 앞머리는 게이트 0xa56dc(a5704~a571a `ldrb [S, #0x12c]`)가 거짓이라 타석 · 투구 줄은 안 쌓이고, 게이트 밖인
 * +0x2a 사사구(a8b04~a8bee) · +0x2e 실책(0x43278 4381a~43904) · +2 사기(3a31e · b5762)만 남는다. 상대국 칸 몫은 그날 밤 지워져 안 담는다
 */
export function recordNariCupGame(teams: NariCupTeams, marks: NariCupGameMarks): NariCupTeams {
  const koreaErrors: Record<number, number> = { ...teams.koreaErrors }
  let hasError = false
  for (const error of marks.errors ?? []) {
    if (error.teamId !== KOREA_TEAM) continue
    koreaErrors[error.battingOrderIndex] = Math.min(CUP_RECORD_COUNTER_LIMIT, (koreaErrors[error.battingOrderIndex] ?? 0) + 1)
    hasError = true
  }
  const myWalks = marks.myWalks ?? 0
  return {
    ...teams,
    ...(marks.morale === undefined ? {} : { koreaMorale: marks.morale }),
    ...(hasError ? { koreaErrors } : {}),
    ...(myWalks > 0 ? { myCupWalks: (teams.myCupWalks ?? 0) + myWalks } : {}),
  }
}

/**
 * 투수편 대표팀 칸 안 내 투수 +0x2c — 대회 초기화 0xb7bf0 가 0xb6191 로 대한민국 투수 전원 10000 을 넣은 **뒤** 133 이 내 레코드를
 * 통째 베끼니 첫날은 그때 내 스태미나, 하루 끝 0xb818c 가 대회 중이면 늘 b81e0 `0xb6191(0x1f9a9(g, 모드, 10))` 로 대표팀 투수 배열
 * `[팀+0x14]` 전원 +0x2c = 10000(0xb6190 61a4 `strh`)을 다시 채우니 둘째 날부터는 10000 이다
 */
export function myCupPitcherStaminaOf(cupDay: number, staminaAtEntry: number): number {
  return cupDay === 0 ? staminaAtEntry : FULL_CUP_PITCHER_STAMINA
}
const FULL_CUP_PITCHER_STAMINA = 10000

/** 대표팀 칸 안 내 투수 +0x2a — 내 레코드를 베낀 값(커리어 시즌 줄) + 대회 중 사사구, 0~9999 */
export function myCupPitcherWalksOf(teams: NariCupTeams | undefined, careerWalks: number): number {
  return Math.min(CUP_RECORD_COUNTER_LIMIT, careerWalks + (teams?.myCupWalks ?? 0))
}

/** 대회 칸의 팀 레코드 — 팀 10 은 대표팀 칸, 그 밖은 상대국 칸(0x1f8f8). 상대국 칸이 다른 팀이면 마스터 복사 */
export function nariCupRecordOf(teams: NariCupTeams, teamId: number): NariTeamRecord {
  if (teamId === KOREA_TEAM) return teams.korea
  return teams.opponentTeamId === teamId ? teams.opponent : masterCupRecordOf(teamId)
}

/** 대표팀 안 내 타순(첨자 + 1) — 없으면 null */
export function nariCupBattingOrderOf(teams: NariCupTeams): number | null {
  const index = myBatterIndexOf(teams.korea)
  return index < 0 ? null : index + 1
}

/**
 * 경기 장면이 팀을 세우는 레코드 — `0xb8680` 모드 3 · 4 → `0x1f989` → 모드 4 `0x1f8f8` · 모드 3 `0x1f940`: 국가대항전(S+0x12c)이면 팀 10 은
 * +0xbc4, 그 밖 팀은 +0xbe0 (대회 칸), 아니면 열 팀 레코드. 커리어가 대회 칸을 아직 안 들었으면(첫 경기 전) 마스터 복사로 본다.
 */
export function nariGameRecordOf(
  career: NariTeamRecordFields & { readonly battingOrder?: number; readonly nariCupTeams?: NariCupTeams },
  teamId: number,
): NariTeamRecord {
  if (teamId >= LEAGUE_TEAM_COUNT) {
    return career.nariCupTeams === undefined ? masterCupRecordOf(teamId) : nariCupRecordOf(career.nariCupTeams, teamId)
  }
  return nariTeamRecordOf(nariTeamsOf(career), teamId)
}
