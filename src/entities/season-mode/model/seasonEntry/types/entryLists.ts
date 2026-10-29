import type { SeasonPlayer } from '@/entities/season-mode/model/playerRecruit'
import type {
  EntryBatterLine,
  EntryBatterRow,
  EntryLists,
  EntryPitcherLine,
  EntryPitcherRow,
  PlayerDetailSource,
} from '@/entities/season-mode/model/entryEditor'

/**
 * 엔트리 목록 창 칸의 재료 (`widgets/entry-editor` 의 0x5c984 열) — 레코드 +0xb & 3 · 시즌 줄 +0x20~ · 체력 줄.
 * 칸 값을 모르면(옛 사본 등) 그 칸을 비운다.
 */
export interface SeasonEntryCells {
  /** 레코드 `+0xb & 3` — 타자 내야 0 · 외야 1 · 2 (0x571d8 세로 줄 색) · 투수 보직 (0xb6ded → 0x545e8) */
  readonly profileLow?: number
  readonly batterLine?: EntryBatterLine
  readonly pitcherLine?: EntryPitcherLine
  /** 체력 줄 — 용량 0x66e44(팀, rec, 0) · 퍼센트 (0x571d8) */
  readonly stamina?: { readonly capacity: number; readonly percent: number }
  /** '0' 상세 창 0x5b798 이 읽는 레코드 칸 (`seasonDetailSourceOf`) */
  readonly detailSource?: PlayerDetailSource
}

/** 편집기 목록 한 줄 (타자) */
export interface SeasonEntryBatter extends EntryBatterRow, SeasonEntryCells {
  readonly name: string
  readonly ability: readonly number[]
  /** 시즌 명단 배열의 첨자 — 마선수는 명단 밖이라 −1 */
  readonly rosterIndex: number
}

/** 편집기 목록 한 줄 (투수) */
export interface SeasonEntryPitcher extends EntryPitcherRow, SeasonEntryCells {
  readonly name: string
  readonly ability: readonly number[]
  readonly rosterIndex: number
}

/**
 * 칸 재료를 어디서 읽는가 — 엔트리 목록 창이 읽는 팀 레코드 칸.
 * - 시즌 줄: 일반모드 레코드는 Xls 행 그대로(행 바이트 32~43), 시즌 · 나리 저장 레코드는 0x204e0 이 비운 뒤 경기마다 쌓은 줄이라
 *   부르는 쪽이 `batterLineOf` · `pitcherLineOf` 로 준다. 안 주면 붙박이 표 칸의 Xls 줄, 표 밖 선수는 비운다.
 * - 체력 줄: S = [ed+0x334] ∈ {1, 2, 3, 4, 8, 9} ? trunc(+0x2c / 100) : 100 (0x572a4) · M = 0x66e44(팀, rec, 0) =
 *   사기 보정 체력 + 250 (`staminaCapacityOf(…, false)`), 체력 = 칸 능력치 [3] (0xb6415(rec, 3, 1)).
 */
export interface SeasonEntryCellSource {
  /** [ed+0x334] — 일반 0x2648c 는 모드 [메뉴+0x13c](1), 시즌 진입들은 2 */
  readonly staminaMode: number
  /** 팀 레코드 사기 (s16 +2) — 0x66e44 의 V[+2] */
  readonly teamMorale: number
  /** 레코드 +0x2c — 안 주면 명단의 `stamina` */
  readonly staminaOf?: (player: SeasonPlayer, index: number) => number
  readonly batterLineOf?: (player: SeasonPlayer) => EntryBatterLine
  readonly pitcherLineOf?: (player: SeasonPlayer) => EntryPitcherLine
}

export type SeasonEntryLists = EntryLists<SeasonEntryBatter, SeasonEntryPitcher>
