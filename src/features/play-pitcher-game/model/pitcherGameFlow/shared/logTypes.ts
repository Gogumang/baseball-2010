export interface PitcherGameLogEntry {
  readonly id: number
  readonly text: string
  /** 사람이 던진 타석인지 — 화면에서 강조한다 */
  readonly isMine: boolean
}
