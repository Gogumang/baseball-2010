/** 수비 위치 코드 → 글자 (레코드 `+0x1c & 0xf`). 원본은 아이콘 `0x54591`(그림 번호 미해독)이라 웹은 글자로 적는다 */
export const FIELD_POSITION_LABELS: readonly string[] = ['후보', '지명', '포수', '1루', '2루', '3루', '유격', '우익', '좌익', '중견']

export function fieldPositionLabelOf(position: number): string {
  return FIELD_POSITION_LABELS[position & 0xf] ?? '-'
}
