import { MY_RECORD_SLOT, tableNariTeamRecord } from '@/entities/career/model/nariTeamRecord'
import type { NariTeamRecord } from '@/entities/career/model/nariTeamRecord'
import type { NariCupTeams } from '@/entities/career/model/nariCupTeams'
import { UNSHUFFLED_PITCHER_ORDER } from '@/entities/league/model/league'
import { advanceRotation } from '@/entities/pitcher-career/model/pitcherRotation'
import { myPitcherPositionCodeOf, prepareMyPitcherOrder } from '@/entities/pitcher-career/model/myPitcherRecord'
import type { PitcherRole } from '@/entities/pitcher-career/model/pitcherRole'

/**
 * **투수편 국가대항전 대회 레코드 두 칸** — 저장 블록 `[저장+0xb8]`(모드 3)의 +0xbc4 대표팀 · +0xbe0 상대국. 타자편
 * `entities/career/model/nariCupTeams` 와 같은 칸·같은 차례이고 다른 것은 내 선수를 넣는 갈래와 142 의 내 팀 몫뿐이다. 직접 떴다:
 * ```
 * 상태 133 0x1a090   출전 갈래: 0xb7bf1 대회 초기화(+0xbc4 마스터 팀 10 깊은 복사 · +0xbe0 첫날 상대) 뒤 모드 ≠ 4 →
 *                    **0xb521d(대표팀, 0x1fbd1(g) 내 투수, 1)** — 내 투수 +0xa 는 0x80(내 육성)이라 0x60 갈래가 아니다 →
 *                    칸 k(+0xa & 0x1f = 내 팀에서의 칸, 포지션 코드)의 대한민국 투수를 맨 끝으로 옮기고 칸 k 에 내 투수 **복사**.
 *                    0x1faa1(g, 1, 1) — 내 선수 포인터 [g+0x3c] 가 그 복사본(대표팀 칸)을 가리킨다(S+0x12c 동안)
 * 142 진입 0x1c46c   같은 문(장면+0x288) 안: g = L+0x32(대회 날짜) ≠ 0 이면 상대 0xb8c80. 모드 3 갈래(1c588~1c5ee)는 내 팀 = 대표팀 칸에
 *                    g == 0 → 0x1b684(0x1f989(g, S+0x12c ? 10 : 내 팀) — 보직 2 가 아니면 내 칸 ↔ 0) · 0xa4f60 → 선발은 −2
 *                    (S+0x12c, 맞바꿈 없음) · 구원·보직 1 은 g ≠ 0 이면 −1 → 0xb8c80 돌리기 (`prepareMyPitcherOrder` 의 isNationalCup)
 * 0xb8768 → 0xb603c  대표팀 칸에서 다시 매긴 내 칸이 그 경기의 포지션 코드다 (복사본 +0xa — 원래 레코드는 그대로)
 * 하루 끝 0xb818c    b81e0 대한민국 투수 10000(복사본 포함) · b8216 다음 날 상대 +0xbe0 새 복사
 * ```
 * 대회 끝(0x1b92c)의 0x1faa1(g, 1, 1) 이 포인터를 내 팀 레코드로 돌린다 — 복사본에 쌓인 것(스태미나 등)은 원래 레코드로 안 온다.
 */

/** 대표팀 팀 번호 */
const KOREA_TEAM = 10

/** 마스터 복사 — 붙박이 표 그대로 · 투수 차례 [0..7] */
function masterCupRecordOf(teamId: number): NariTeamRecord {
  return { ...tableNariTeamRecord(teamId), pitchers: UNSHUFFLED_PITCHER_ORDER }
}

/** 0xb521c 의 0x80 갈래 — 배열을 하나 늘려 칸 k 의 선수를 맨 끝으로, 칸 k 에 내 투수 */
function insertMyPitcher(order: readonly number[], slot: number): readonly number[] {
  const next = [...order]
  if (slot >= next.length) return [...next, MY_RECORD_SLOT]
  next.push(next[slot])
  next[slot] = MY_RECORD_SLOT
  return next
}

/** 대회 초기화 0xb7bf0 + 상태 133 의 0xb521d — `myPitcherSlot` 은 내 팀에서의 내 칸(포지션 코드) */
export function createPitcherCupTeams(myPitcherSlot: number, firstOpponentTeamId: number): NariCupTeams {
  const korea = masterCupRecordOf(KOREA_TEAM)
  return {
    korea: { ...korea, pitchers: insertMyPitcher(korea.pitchers ?? UNSHUFFLED_PITCHER_ORDER, myPitcherSlot) },
    opponent: masterCupRecordOf(firstOpponentTeamId),
    opponentTeamId: firstOpponentTeamId,
  }
}

/** 142 진입(1c574~1c5ee) 의 대회 몫 — 상대국은 g ≠ 0 이면 돌리고, 대표팀은 내 팀 몫(0x1b684 · 0xa4f60 국가대항전 갈래) */
export function preparePitcherCupMatch(teams: NariCupTeams, cupDay: number, role: PitcherRole): NariCupTeams {
  const koreaOrder = teams.korea.pitchers ?? UNSHUFFLED_PITCHER_ORDER
  const opponentOrder = teams.opponent.pitchers ?? UNSHUFFLED_PITCHER_ORDER
  return {
    ...teams,
    korea: {
      ...teams.korea,
      pitchers: prepareMyPitcherOrder(koreaOrder, { dayCounter: cupDay, role, isNationalCup: true }),
    },
    opponent: { ...teams.opponent, pitchers: cupDay === 0 ? opponentOrder : advanceRotation(opponentOrder) },
  }
}

/** 대표팀 칸 안 내 칸 — 그 경기의 포지션 코드(0xb8768 이 다시 매긴 복사본 +0xa) */
export function pitcherCupPositionCodeOf(teams: NariCupTeams): number {
  return myPitcherPositionCodeOf(teams.korea.pitchers ?? [])
}
