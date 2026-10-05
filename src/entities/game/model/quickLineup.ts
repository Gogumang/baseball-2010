import {
  EMPTY_BATTER_GAME_RECORD,
  judgeCpuPinchHit,
  recordPlateAppearance,
} from '@/entities/batting/model/pinchHitAi'
import type { BatterGameRecord } from '@/entities/batting/model/pinchHitAi'
import { isHit } from '@/entities/at-bat/model/atBatOutcome'
import type { AtBatOutcome } from '@/entities/at-bat/model/atBatOutcome'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 간이 엔진이 도는 경기(리그 CPU 경기 0xc2a48 · 나만의리그 타자편의 자동 타석)의 **한 팀 명단**.
 *
 * 원본 팀 객체 `team+0xe` 목록 — 앞 아홉 칸이 타순, 그 뒤가 벤치다 (E 3b). 타순 칸마다
 * 이 경기 기록 24바이트(`team + 0x34 + 타순×0x18`)가 붙어 있고, CPU 대타 `0xac228` 이 그중
 * 안타(+0x12)·적시타(+0x13)·타석(+0x14)을 본다. 벤치 타자 수는 `team+0x28c` 다.
 *
 * 대타가 들어오면 확정 `0xaebe4` 의 대타 가지(`aecac~aedec`)가 명단 두 칸과 그 기록을 맞바꾸고
 * 빠진 선수를 명단에서 지운다 — 재출장은 없다 (`features/play-team-game` 의 `substituteBatter` 와
 * 같은 자리다. 그쪽은 수비 위치 니블까지 옮기지만 간이 엔진은 수비 위치를 안 본다).
 */
export interface QuickLineup {
  /** 명단 칸마다 로스터 칸 — `[0..8]` 타순, `[9..]` 벤치 */
  readonly rosterSlots: readonly number[]
  /** 명단 칸마다 이 경기 기록 (`0xa8024` 이 세운다) */
  readonly records: readonly BatterGameRecord[]
  /** `team+0x28c` 벤치 타자 수 */
  readonly benchBatters: number
}

/** 타순 칸 수 — `0xaf020` 이 `(team+0x32 + 1) mod 9` 로 돈다 */
export const QUICK_LINEUP_SIZE = 9

/** 경기 시작 명단 — 로스터 차례 그대로다 (앞 아홉이 타순, 나머지가 벤치) */
export function rosterLineupOf(rosterSize: number): QuickLineup {
  const rosterSlots = Array.from({ length: rosterSize }, (_unused, slot) => slot)
  return {
    rosterSlots,
    records: rosterSlots.map(() => EMPTY_BATTER_GAME_RECORD),
    benchBatters: Math.max(0, rosterSize - QUICK_LINEUP_SIZE),
  }
}

/** 타순 커서(이닝 안에서 9 를 넘어 셀 수 있다)가 가리키는 명단 칸 */
export function lineupSlotOf(order: number): number {
  return ((order % QUICK_LINEUP_SIZE) + QUICK_LINEUP_SIZE) % QUICK_LINEUP_SIZE
}

/** 그 타순에 지금 선 선수의 로스터 칸 */
export function rosterSlotAt(lineup: QuickLineup, order: number): number {
  const slot = lineupSlotOf(order)
  return lineup.rosterSlots[slot] ?? slot
}

/** 타석 하나를 그 타순 칸 기록에 얹는다 (`0xa8024` 의 세 칸 — 견제가 없는 간이 타석은 늘 타구 플레이다) */
export function recordLineupPlay(
  lineup: QuickLineup,
  order: number,
  outcome: AtBatOutcome,
  runsBattedIn: number,
): QuickLineup {
  const slot = lineupSlotOf(order)
  const records = [...lineup.records]
  records[slot] = recordPlateAppearance(records[slot] ?? EMPTY_BATTER_GAME_RECORD, {
    isHit: isHit(outcome),
    runsBattedIn,
  })
  return { ...lineup, records }
}

/** CPU 대타 한 번의 결과 — 누가 나가고 누가 들어왔는가(로스터 칸) */
export interface QuickPinchHit {
  readonly lineup: QuickLineup
  readonly outgoingRosterSlot: number
  readonly incomingRosterSlot: number
}

/**
 * 타석 시작에 **CPU 대타** `0xac228` 을 한 번 물어보고, 내면 확정 `0xaebe4` 의 대타 가지까지 돌린다.
 *
 * 간이 엔진 `0xc1ba4` 는 공격 팀이 누구든 **가림막 없이** 부른다 (`0xc1c50`) — 수비 팀 투수 교체
 * `0xac428` 보다 먼저다. 타석 시작(0-0)이라 볼카운트 항은 0 이다.
 *
 * ⚠️ 원본이 보는 **마선수 비트**(`0xb633d`)와 **장비 레벨 니블**(`+0x19`·`+0x1a`)은 웹 로스터 표에
 * 없다 — 리그 로스터 선수는 둘 다 늘 0 이라 결과가 같다.
 */
export function tryQuickCpuPinchHit(
  lineup: QuickLineup,
  order: number,
  situation: {
    /** `state[0xe]` — 다음 공이 나가기 전까지 막는 칸 (양 팀 공용 한 칸, 공마다 `0xa5e14` a5e7c 가 내린다) */
    readonly alreadyUsedThisGame: boolean
    /** 주자 수 (`0xa9599` = 주자관리 `+0xc`) */
    readonly runnerCount: number
  },
  random: RandomPort,
): QuickPinchHit | null {
  const slot = lineupSlotOf(order)
  const benchIndex = judgeCpuPinchHit(
    {
      alreadyUsedThisGame: situation.alreadyUsedThisGame,
      batterIsAce: false,
      // 원본은 team+0x28c 만 보고 rand(0, n) 을 돌린다 — 명단 칸이 모자랄 일은 없지만 실제 칸 수로 자른다
      benchBatters: Math.min(
        lineup.benchBatters,
        Math.max(0, lineup.rosterSlots.length - QUICK_LINEUP_SIZE),
      ),
      record: lineup.records[slot] ?? EMPTY_BATTER_GAME_RECORD,
      runnerCount: situation.runnerCount,
      strikes: 0,
      balls: 0,
    },
    random,
  )
  if (benchIndex < 0) return null

  // 0xaf06c(team, k, 0) 이 team+0x293 = 9 + k 로 예약 → 0xaebe4 가 확정한다
  const entryIndex = QUICK_LINEUP_SIZE + benchIndex
  const outgoingRosterSlot = lineup.rosterSlots[slot]
  const incomingRosterSlot = lineup.rosterSlots[entryIndex]
  if (outgoingRosterSlot === undefined || incomingRosterSlot === undefined) return null

  const rosterSlots = [...lineup.rosterSlots]
  const records = [...lineup.records]
  // 명단 두 칸과 그 기록 24바이트를 맞바꾼다 (aed02~aed14)
  rosterSlots[slot] = incomingRosterSlot
  rosterSlots[entryIndex] = outgoingRosterSlot
  records[slot] = lineup.records[entryIndex] ?? EMPTY_BATTER_GAME_RECORD
  records[entryIndex] = lineup.records[slot] ?? EMPTY_BATTER_GAME_RECORD
  // 빠진 선수를 명단에서 지운다 — 재출장은 없다 (aed16 `0xb95b1`)
  rosterSlots.splice(entryIndex, 1)
  records.splice(entryIndex, 1)

  return {
    lineup: {
      rosterSlots,
      records,
      // 벤치 타자 수 −1, 0 밑으로는 안 간다 (aed9c~aedae)
      benchBatters: Math.max(0, lineup.benchBatters - 1),
    },
    outgoingRosterSlot,
    incomingRosterSlot,
  }
}
