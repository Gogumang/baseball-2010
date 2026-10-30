/**
 * 차례의 로스터 칸 하나하나를 붙박이 표 칸으로 — 표에 없는 칸(`rosterSlot` −1 · 범위 밖)은
 * **아직 안 쓴 표 칸을 작은 번호부터** 채운다. 기록을 실은 칸(`null`)은 표 칸을 안 쓴다.
 *
 * 기록 없이 들어온 표 밖 선수는 지어내지 않으려고 그 팀 표 선수로 자리만 채운다. 앱 길에서는 닿지 않는다(r278 확인): 나리 선수는
 * 영입 때부터 기록 사본(`SeasonPlayer.record`)을 들고, 명전 선수는 앱이 늘 기록연감의 명전 칸을 넘기며(`readHallOfFame`) 명전 칸 삭제는
 * 시즌 명단에서도 그 선수를 뺀다(0x221dc). 기록 원천을 안 넘기는 시험 · 부르는 쪽만 이 대체를 탄다.
 */
export function tableSlotsOfOrder(slots: readonly (number | null)[], tableSize: number): readonly (number | null)[] {
  const isTableSlot = (slot: number | null): slot is number => slot !== null && Number.isInteger(slot) && slot >= 0 && slot < tableSize
  const used = new Set(slots.filter(isTableSlot))
  let spare = 0
  return slots.map((slot) => {
    if (slot === null || isTableSlot(slot)) return slot
    while (spare < tableSize && used.has(spare)) spare += 1
    const filled = spare < tableSize ? spare : 0
    used.add(filled)
    return filled
  })
}

/** 차례 한 칸이 경기 팀이 아닌 붙박이 표 팀을 가리키는가 (트레이드로 옮겨 온 선수) */
export const isForeignTable = (tableTeamId: number | undefined, teamId: number): tableTeamId is number =>
  tableTeamId !== undefined && tableTeamId !== teamId

/** 장비 니블 칸 — 있을 때만 싣는다 */
export function equipmentOf(equipment: readonly number[] | undefined): { readonly equipment?: readonly number[] } {
  return equipment === undefined ? {} : { equipment }
}
