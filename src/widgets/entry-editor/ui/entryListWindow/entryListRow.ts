import type { EntryBatterLine, EntryPitcherLine } from '@/widgets/entry-editor/lib/entryListWindow'

/** 목록 한 줄이 칸에 그릴 재료 — 없는 칸은 비운다 */
export interface EntryListRow {
  readonly name: string
  /** 타자 수비 위치 `+0x1c & 0xf` (0x54590) */
  readonly position?: number
  /** 레코드 `+0xb & 3` — 타자 이름 칸 세로 줄 색(0x571d8) · 투수 보직(0xb6ded → 0x545e8) */
  readonly profileLow?: number
  readonly batterLine?: EntryBatterLine
  readonly pitcherLine?: EntryPitcherLine
  /** 투수 체력 줄 — 용량 `0x66e44(팀, rec, 0)` · 퍼센트 S (0x571d8) */
  readonly stamina?: { readonly capacity: number; readonly percent: number }
}
