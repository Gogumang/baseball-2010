/** 이번 경기 기록 줄 — 진입 0x4ea0c 4ebe0~4ec36: 기록 0..39 가운데 횟수가 있는 것만 번호 차례로 */
export function settlementRecordRowsOf(recordIds: readonly number[]): { id: number; count: number }[] {
  const counts = new Map<number, number>()
  for (const id of recordIds) counts.set(id, (counts.get(id) ?? 0) + 1)
  return [...counts.entries()]
    .filter(([id]) => id >= 0 && id <= 0x27)
    .sort(([a], [b]) => a - b)
    .map(([id, count]) => ({ id, count }))
}

/** "!R%d회" (0xd0970) */
export const recordCountTextOf = (count: number) => `${count}회`
/** "!C기록이 없습니다!" (0xd0978) */
export const NO_RECORD_TEXT = '기록이 없습니다!'
/** "승리 추가 보상[!cffff00"(0xd060c) + v + " G포인트!cffffff]"(0xd0624) */
export const versusRewardTextOf = (bonus: number) => `승리 추가 보상[!cffff00${bonus} G포인트!cffffff]`
