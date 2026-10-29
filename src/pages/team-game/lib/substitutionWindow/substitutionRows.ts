import type { TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import type { TeamEntryBatter, TeamEntryPitcher } from '@/features/play-team-game/model/teamGameRoster'
import { substitutionStaminaOf } from '@/features/play-team-game/model/teamGameFlow'
import { batterPositionBadgeOf, pitcherRoleBadgeOf } from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import type { TeamMatchupRecords } from '@/pages/team-game/lib/teamMatchupCards'
import { teamBatterSeasonStatsOf, teamPitcherSeasonStatsOf } from '@/pages/team-game/lib/teamMatchupCards'
import { entryProfileOf } from './entryProfile'

/** 칸 4 개 중 둘째 칸의 딱지 — game_ui 프레임(칸 위에 겹침) · img_text 글자. 없으면 null */
export interface CellBadge {
  readonly chipFrame: number
  readonly label: number
}

/** 체력 줄 (0x571d8 투수 갈래) — 녹 #1C9300 최대 · 빨 #FF3C14 지금, 이름 칸 바닥 두 줄 */
export interface StaminaLines {
  readonly length: number
  readonly current: number
}

/** 타자 이름 칸 오른쪽 세로 두 줄 (0x571d8 타자 갈래) — 색은 +0xb & 3 (0 #89DB14 · 1 #FF3C14 · 2 #14B3DB) */
export const FIELDER_TYPE_COLORS: readonly string[] = ['#89DB14', '#FF3C14', '#14B3DB']

export interface SubstitutionRow {
  /** 명단 칸 */
  readonly index: number
  readonly name: string
  readonly badge: CellBadge | null
  /** 방어율 ×100 / 타율 ×1000 — 기록이 없으면 null (⚠️ `substitutionRowsOf`) */
  readonly rate: number | null
  /** 탈삼진 / 홈런 */
  readonly count: number | null
  readonly stamina: StaminaLines | null
  /** 타자 이름 칸 세로 줄 색 칸 (+0xb & 3) — 투수는 null */
  readonly fielderType: number | null
}

/** 0x571d8 의 이름 칸 폭 w */
const NAME_CELL_WIDTH = 54
/** 0x571d8 의 나눗수 0x4e1 (= 1249) */
const STAMINA_LINE_DIVISOR = 0x4e1
/** 딱지 game_ui 프레임 = 0x20 + 칸 번호 (0x545e8 · 0x54590) */
const BADGE_CHIP_BASE = 0x20

/**
 * 투수 체력 줄 길이 — 0x571d8 `L = trunc(trunc(M × (w × 100 − 400) / 1249) / 100)` · `R = trunc(S × L / 100)` (w = 54).
 * 녹 선 (x + 3, y + h − 2)~(x + 3 + L, …) 과 한 줄 아래, 빨 선 (x + 3)~(x + 3 + R) 두 줄.
 */
export function staminaLinesOf(capacity: number, percent: number, cellWidth = NAME_CELL_WIDTH): StaminaLines {
  const length = Math.trunc(Math.trunc((capacity * (cellWidth * 100 - 400)) / STAMINA_LINE_DIVISOR) / 100)
  return { length, current: Math.trunc((percent * length) / 100) }
}

/** 벤치 타자 줄의 딱지 — 타자 레코드 +0xb & 3 (0x38240). 3 은 딱지가 없다 */
const BENCH_BADGE_BY_FIELDER_TYPE: Readonly<Record<number, CellBadge>> = {
  0: { chipFrame: 37, label: 304 },
  1: { chipFrame: 36, label: 305 },
  2: { chipFrame: 39, label: 306 },
}

/** 보직 딱지 0x545e8 — 칸 = 0x20 + 칸 번호 (선발 36 · 중계 39 · 구원 37) */
function roleBadgeOf(role: number | undefined): CellBadge | null {
  if (role === undefined || role < 0 || role > 2) return null
  const badge = pitcherRoleBadgeOf(role, 0)
  return { chipFrame: BADGE_CHIP_BASE + badge.chip, label: badge.label }
}

/** 지금 타자 칸의 수비 위치 딱지 0x54590(+0x1c & 0xf) — 칸이 없으면 null */
function positionBadgeOf(position: number | undefined): CellBadge | null {
  if (position === undefined) return null
  const badge = batterPositionBadgeOf(position, -1, -1)
  if (badge.chip < 0) return null
  return { chipFrame: BADGE_CHIP_BASE + badge.chip, label: badge.label }
}

/** 방어율 · 탈삼진 칸 — 소개 판과 같은 시즌 줄. 0xb6ce9 — 100 보다 크면 ×10 해서 소수 셋 자리 (0x37b24) */
function pitcherSeasonCellsOf(progress: TeamGameProgress, records: TeamMatchupRecords | undefined, entry: TeamEntryPitcher | undefined) {
  if (entry === undefined) return { rate: null, count: null }
  const stats = teamPitcherSeasonStatsOf(progress, records, progress.options.ourTeamId, entry)
  return { rate: stats?.earnedRunAverage ?? null, count: stats?.strikeouts ?? null }
}

/** 타율 · 홈런 칸 — 소개 판과 같은 시즌 줄 */
function batterSeasonCellsOf(progress: TeamGameProgress, records: TeamMatchupRecords | undefined, entry: TeamEntryBatter | undefined) {
  if (entry === undefined) return { rate: null, count: null }
  const stats = teamBatterSeasonStatsOf(progress, records, progress.options.ourTeamId, entry)
  return { rate: stats?.battingAverage ?? null, count: stats?.homeRuns ?? null }
}

function pitcherRowOf(progress: TeamGameProgress, records: TeamMatchupRecords | undefined, index: number): SubstitutionRow {
  const entry = progress.ourPitcherEntry[index]
  const cells = pitcherSeasonCellsOf(progress, records, entry)
  const stamina = substitutionStaminaOf(progress, index)
  return {
    index,
    name: entry?.name ?? '',
    badge: roleBadgeOf(entry?.role),
    ...cells,
    stamina: stamina === null ? null : staminaLinesOf(stamina.capacity, stamina.percent),
    fielderType: null,
  }
}

/** 타자 레코드 +0xb & 3 — 명단 칸이 비면 0 */
const fielderTypeOf = (progress: TeamGameProgress, entry: TeamEntryBatter | undefined) =>
  entry === undefined ? 0 : entryProfileOf(progress, entry) & 3

function batterRowOf(progress: TeamGameProgress, records: TeamMatchupRecords | undefined, index: number, isCurrent: boolean): SubstitutionRow {
  const entry = progress.ourEntry[index]
  const cells = batterSeasonCellsOf(progress, records, entry)
  const fielderType = fielderTypeOf(progress, entry)
  // 지금 타자 칸은 수비 위치 0x54590(+0x1c & 0xf), 벤치 줄은 +0xb & 3 (0x38240) — 두 함수가 다른 칸을 읽는다
  const badge = isCurrent ? positionBadgeOf(entry?.position) : (BENCH_BADGE_BY_FIELDER_TYPE[fielderType] ?? null)
  return { index, name: entry?.name ?? '', badge, ...cells, stamina: null, fielderType }
}

/**
 * 창의 줄 — 지금 선수(투수 `0xae83c` · 타자 `0xae89c`)와 벤치(`0xb8b09` · `0xb8b19`).
 * 방어율 · 탈삼진 / 타율 · 홈런 칸은 소개 판과 같은 시즌 줄(`teamPitcherSeasonStatsOf` · `teamBatterSeasonStatsOf`)이다 — 일반모드는
 * Xls 행의 줄, 마선수는 XlsACE 행의 줄. ⚠️ 남은 것: 대전(8 · 9)은 웹에 없고, 기록표가 없을 때의 표 밖 선수는 숫자를 비운다.
 */
export function substitutionRowsOf(
  progress: TeamGameProgress,
  kind: '투수' | '대타',
  benchIndexes: readonly number[],
  records: TeamMatchupRecords | undefined,
): { readonly current: SubstitutionRow; readonly bench: readonly SubstitutionRow[] } {
  if (kind === '투수') {
    return {
      current: pitcherRowOf(progress, records, progress.ourPitcherIndex),
      bench: benchIndexes.map((index) => pitcherRowOf(progress, records, index)),
    }
  }
  return {
    current: batterRowOf(progress, records, progress.game.battingOrderIndex, true),
    bench: benchIndexes.map((index) => batterRowOf(progress, records, index, false)),
  }
}
