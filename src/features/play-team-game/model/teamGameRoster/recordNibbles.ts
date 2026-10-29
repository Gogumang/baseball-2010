import type {
  TeamEntryBatter,
  TeamEntryBatterRecord,
  TeamEntryOrder,
  TeamEntryPitcher,
  TeamEntryPitcherRecord,
} from '@/features/play-team-game/model/teamGameRoster/entryTypes'

/** 기록 사본에서 채울 칸(니블 · +0xb · +0x1b)을 이미 다 들었는가 */
function hasAllBatterNibbles(batter: TeamEntryBatter): boolean {
  return batter.equipment !== undefined && batter.profile !== undefined && batter.salaryGrade !== undefined
}

/** 빠진 칸만 기록에서 채운다 — 있는 값은 그대로 */
function batterWithRecordNibbles(batter: TeamEntryBatter, record: TeamEntryBatterRecord): TeamEntryBatter {
  return {
    ...batter,
    ...(batter.equipment !== undefined || record.equipment === undefined ? {} : { equipment: record.equipment }),
    ...(batter.profile !== undefined || record.profile === undefined ? {} : { profile: record.profile }),
    ...(batter.salaryGrade !== undefined || record.salaryGrade === undefined ? {} : { salaryGrade: record.salaryGrade }),
  }
}

/**
 * **옛 경기 저장 이사** — 기록 사본에 니블 · +0xb 를 싣기 전에 저장한 경기 블록의 명단은 기록으로 선 영입 선수에게 그 칸이 없다.
 * 원본은 팀 레코드(영입 0xc554 가 옮긴 0x30 바이트) 하나를 경기와 시즌이 함께 쓰므로, 지금 시즌 명단으로 만든 명단 차례(`order`)의
 * 같은 원본 id(`recordId`) 기록에서 빠진 칸만 채운다 — 있는 값은 그대로다. 표 줄 · 마선수는 손대지 않는다.
 */
export function withBatterRecordNibbles(entry: readonly TeamEntryBatter[], order: TeamEntryOrder): readonly TeamEntryBatter[] {
  return entry.map((batter) => {
    if (batter.recordId === undefined || hasAllBatterNibbles(batter)) return batter
    const record = order.batters.find((candidate) => candidate.record?.recordId === batter.recordId)?.record
    if (record === undefined) return batter
    return batterWithRecordNibbles(batter, record)
  })
}

/** 차례의 투수 칸 가운데 이 원본 id 의 기록 (표 칸 번호 · 표 자리는 아니다) */
function pitcherRecordOf(order: TeamEntryOrder, recordId: number): TeamEntryPitcherRecord | undefined {
  return order.pitchers.find(
    (candidate): candidate is TeamEntryPitcherRecord => typeof candidate !== 'number' && 'recordId' in candidate && candidate.recordId === recordId,
  )
}

/** 빠진 니블 · +0x1b 만 기록에서 채운다 — 채울 것이 없으면 그 투수 그대로 */
function pitcherWithRecordNibbles(pitcher: TeamEntryPitcher, record: TeamEntryPitcherRecord): TeamEntryPitcher {
  const fillsEquipment = pitcher.equipment === undefined && record.equipment !== undefined
  const fillsSalary = pitcher.salaryGrade === undefined && record.salaryGrade !== undefined
  if (!fillsEquipment && !fillsSalary) return pitcher
  return {
    ...pitcher,
    ...(fillsEquipment ? { equipment: record.equipment } : {}),
    ...(fillsSalary ? { salaryGrade: record.salaryGrade } : {}),
  }
}

/** `withBatterRecordNibbles` 의 투수 쪽 — 기록으로 선 영입 투수의 니블(마운드 장비 겹 0x79790) · +0x1b(상세 창 연봉)만 채운다 */
export function withPitcherRecordNibbles(entry: readonly TeamEntryPitcher[], order: TeamEntryOrder): readonly TeamEntryPitcher[] {
  return entry.map((pitcher) => {
    if (pitcher.recordId === undefined || (pitcher.equipment !== undefined && pitcher.salaryGrade !== undefined)) return pitcher
    const record = pitcherRecordOf(order, pitcher.recordId)
    if (record === undefined) return pitcher
    return pitcherWithRecordNibbles(pitcher, record)
  })
}
