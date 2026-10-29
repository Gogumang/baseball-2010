import {
  ACE_BATTER_ROSTER_SLOT,
  ACE_BATTERS,
  EMPTY_BATTER_GAME_RECORD,
  QUICK_LINEUP_SIZE,
  renumberedRecordSlotsOf,
  rosterSlotAt,
  teamBatters,
  type QuickLineup,
} from '@/entities/career/model/nariTeamRecord/otherSlices'
import { MY_RECORD_SLOT, type NariRecordFielder, type NariTeamRecord } from '@/entities/career/model/nariTeamRecord/types'

/**
 * 레코드 타자 배열을 차례 그대로 — `0xb8680(팀)` 이 내주는 `[T+0x18]` 을 `0xb8a34(팀, k)` 로 훑는 곳(공수 교대 판 이름표 0x40008 ·
 * +0xec 0x3fac4 · 벤치 클리어링 0x3a5f0)이 이 차례로 본다. 내 선수 줄 이름은 `myName`, 마타자 줄은 마선수 표, 나머지는 그 팀 붙박이 표 행.
 */
export function nariRecordFieldersOf(record: NariTeamRecord, teamId: number, myName: string | null): readonly NariRecordFielder[] {
  const table = teamBatters(teamId)
  const slots = nariLineupSlotsOf(record)
  return record.batters.map((row, index) => {
    const lineupSlot = slots[index]
    if (row.ace !== undefined) return { name: ACE_BATTERS[row.ace]?.name ?? '', position: row.position, ace: row.ace, lineupSlot }
    if (row.slot === MY_RECORD_SLOT) return { name: myName ?? '', position: row.position, ace: null, lineupSlot }
    return { name: table[row.slot]?.name ?? '', position: row.position, ace: null, lineupSlot }
  })
}

/**
 * **대타 뒤 레코드 자리 니블** — 대타 확정 0xaebe4 의 대타 가지(직접 뜸 2026-10-14):
 * ```
 * aecac  옛 = 레코드[team+0xe[+0x32]] (지금 타순 칸) ; 새 = 레코드[team+0xe[+0x293]] (벤치 칸)
 * aecce  n옛 = 옛+0x1c & 0xf ; n새 = 새+0x1c & 0xf
 * aece6  0xb8e84(옛, n새, 1) ; 0xb8e84(새, n옛, 1)      ; 두 레코드의 자리 니블을 맞바꾼다
 * aed02  명단 team+0xe 두 칸 맞바꿈 → aed26 0xb95b0 로 빠진 칸 지우기 (레코드 배열 [T+0x18] 의 차례는 그대로)
 * ```
 * 레코드 배열은 경기를 세울 때 명단 칸 k = 레코드 k(0xb891c `team[0xe + i] = i`)이고 웹 `QuickLineup` 은 빠진 선수를 지운 명단이라,
 * 지금 타순 칸 s 에 선 레코드 r ≠ s 마다 r 은 칸 s 시작 레코드의 니블을, 시작 레코드 s 는 r 의 니블을 받는다.
 * ⚠️ 근사(남김 — 결과 같음, 시험으로 못 박음): 한 칸에 대타가 둘 이상 들어오면 중간에 빠진 대타는 다음 대타의 니블을 받는데 웹은 제 니블을
 * 둔다 — 벤치 니블은 붙박이 표에서 모두 0 이라(XlsBATTER_DATA 행 바이트 28, `nariTeamRecord.test` 의 표 시험) 결과가 같다. 원본 꼴(대타마다
 * 맞바꿈)로 옮기려면 대타 차례 이력이 있어야 하는데 웹 명단(`QuickLineup`)은 마지막 명단만 든다(빠진 칸은 0xb95b0 처럼 지운다).
 * 명단 칸 값으로 레코드 줄을 찾지 못하면 그 칸은 건너뛴다.
 */
export function nariFieldersAfterPinchHits(
  fielders: readonly NariRecordFielder[],
  lineup: QuickLineup | null | undefined,
): readonly NariRecordFielder[] {
  if (lineup == null) return fielders
  const positions = fielders.map((fielder) => fielder.position)
  for (let order = 0; order < QUICK_LINEUP_SIZE; order += 1) {
    const value = rosterSlotAt(lineup, order)
    const row = fielders.findIndex((fielder) => fielder.lineupSlot === value)
    if (row < 0 || row === order || fielders[order] === undefined) continue
    positions[row] = fielders[order].position
    positions[order] = fielders[row].position
  }
  return fielders.map((fielder, index) => (positions[index] === fielder.position ? fielder : { ...fielder, position: positions[index] }))
}

/**
 * 경기용 명단 칸 — `QuickLineup.rosterSlots` 의 값(붙박이 표 칸 · 마타자 `ACE_BATTER_ROSTER_SLOT`).
 * 내 선수 줄은 사람이 치므로 간이 타석을 안 지나지만, 진행기가 지금 타석 칸의 주루(`runnerRunAbilityOf`)를 그 칸 번호의
 * 표 행으로 읽는 근사가 있어 예전과 같게 **내 첨자**를 표 칸으로 둔다.
 */
export function nariLineupSlotsOf(record: NariTeamRecord): readonly number[] {
  return record.batters.map((row, index) => {
    if (row.ace !== undefined) return ACE_BATTER_ROSTER_SLOT
    return row.slot === MY_RECORD_SLOT ? index : row.slot
  })
}

/**
 * 경기용 명단 — `0xb891c` 의 `team[0xe + i] = i` · 벤치 수 `team+0x28c` = 타자 수 − 9 (b897c~b8988). 경기 기록 칸은 빈 채로.
 */
export function nariQuickLineupOf(record: NariTeamRecord): QuickLineup {
  const rosterSlots = nariLineupSlotsOf(record)
  return {
    rosterSlots,
    records: rosterSlots.map(() => EMPTY_BATTER_GAME_RECORD),
    benchBatters: Math.max(0, rosterSlots.length - QUICK_LINEUP_SIZE),
    // 경기 장면 0x39fdc(3a2fa)가 0xb8768 → 0xb603c 로 다시 매긴다 — 붙박이 칸이 아니라 이 레코드 배열의 첨자
    recordSlots: renumberedRecordSlotsOf(rosterSlots.length),
  }
}
