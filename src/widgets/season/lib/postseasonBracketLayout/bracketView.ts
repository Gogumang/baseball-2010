import { type PostseasonSeries, withSemiPlayoffWinner } from '@/entities/league/model/league'
import { CELL_QUALIFIER_INDEX } from '@/widgets/season/lib/postseasonBracketLayout/bracketBoxes'
import { LINE_FRAMES, type LineFrame } from '@/widgets/season/lib/postseasonBracketLayout/bracketLines'

/** 빨강으로 다시 채우는 박스 하나 — 프레임 54~57 의 박스 번호 */
export interface RedBox {
  readonly frame: LineFrame
  readonly box: number
}

/** 대진표에 그릴 상태 */
export interface BracketView {
  /** 팀 칸 0~3 에 앉은 팀 번호 (`CELL_QUALIFIER_INDEX`). 모르면 null */
  readonly cellTeams: readonly (number | null)[]
  /** 빨강으로 다시 채울 박스 — 원본이 칠하는 차례 그대로(겹쳐도 그대로 둔다) */
  readonly redBoxes: readonly RedBox[]
  /** 팀 칸 k 를 검정 단계 7 로 덮는가 (진 팀 표시 — 0x8580e~0x85858) */
  readonly darkCells: readonly boolean[]
  /** 한국시리즈 우승 팀 (L+0x37) */
  readonly champion: number | null
}

const EMPTY_VIEW: BracketView = {
  cellTeams: [null, null, null, null],
  redBoxes: [],
  darkCells: [false, false, false, false],
  champion: null,
}

/** 대진 칸 L[0x39] · L[0x3b] 의 '미정' 값 (0xb80a8 `movs r5, #0xa`) */
const UNDECIDED = 10

const boxesOf = (frame: LineFrame, count: number): RedBox[] => Array.from({ length: count }, (_, box) => ({ frame, box }))

/**
 * 진행 중인 시리즈에서 대진표 상태를 뽑는다 — 0x853ac 의 0x85536~0x8580e 를 직접 떴다.
 *
 * 원본은 대진 칸 여섯 개를 읽는다: a = L[0x3d](4위) · b = L[0x3c](3위) · s = L[0x3b](준PO 승자) · c = L[0x3a](2위)
 * · p = L[0x39](PO 승자) · d = L[0x38](1위). s · p 는 0xb80a8 이 10 으로 깔고 0xb7724 가 시리즈가 끝날 때 채운다(R13 8절).
 * ```
 * s != 10:  f = s == b ? 54 : 55 ; f 박스 0..2 빨강 ; 55 박스 0 · 56 박스 0 빨강 ; s == b ? 덮기[1] : 덮기[0]
 * p != 10:  (f, n) = p == b ? (54, 5) : p == a ? (55, 5) : (56, 3) ; f 박스 0..n−1 빨강 ; 56 박스 0 · 57 박스 0 빨강
 *           p == c ? 덮기[0] · 덮기[1] : 덮기[2]
 * L[0x36]:  e = L[0x37] ; f = e == a ? 55 : e == b ? 54 : e == c ? 56 : 57 ; f 박스 전부 빨강
 *           e == d ? 덮기[0..2] : 덮기[3]
 * ```
 * 준PO 뒤 "55 박스 0 · 56 박스 0", PO 뒤 "56 박스 0 · 57 박스 0" 은 **누가 이겼든** 칠한다 — 진 쪽 칸 세로선도
 * 빨개지는 것은 원본 그대로다.
 *
 * 웹 모델과 맞춤: s = `semiPlayoffWinner`(L+0x3b — `advancePostseason` 이 남긴다. 옛 저장은 `withSemiPlayoffWinner`
 * 로 되살리고, 그래도 모르면 10), p = 한국시리즈·종료의 아랫 시드 `teams[1]`(L+0x39), L[0x36] = `round === '종료'`.
 */
export function bracketViewOf(series: PostseasonSeries | null): BracketView {
  if (series === null) return EMPTY_VIEW

  const team = (index: number) => series.qualifiers[index] ?? null
  const seeds: BracketSeeds = { d: team(0), c: team(1), b: team(2), a: team(3) }
  const cellTeams = CELL_QUALIFIER_INDEX.map(team)

  const redBoxes: RedBox[] = []
  const darkCells = [false, false, false, false]
  for (const mark of [semiPlayoffMarkOf(series, seeds), playoffMarkOf(series, seeds), finalMarkOf(series, seeds)]) {
    if (mark === null) continue
    redBoxes.push(...mark.redBoxes)
    for (const cell of mark.darkCells) darkCells[cell] = true
  }

  return { cellTeams, redBoxes, darkCells, champion: series.champion }
}

/** 대진 칸 — d = L[0x38](1위) · c = L[0x3a](2위) · b = L[0x3c](3위) · a = L[0x3d](4위) */
interface BracketSeeds {
  readonly d: number | null
  readonly c: number | null
  readonly b: number | null
  readonly a: number | null
}

/** 시리즈 하나가 끝나 칠하는 것 — 빨강 박스(차례 그대로)와 덮는 팀 칸 */
interface BracketMark {
  readonly redBoxes: readonly RedBox[]
  readonly darkCells: readonly number[]
}

/** s != 10: f = s == b ? 54 : 55 ; f 박스 0..2 빨강 ; 55 박스 0 · 56 박스 0 빨강 ; s == b ? 덮기[1] : 덮기[0] */
function semiPlayoffMarkOf(series: PostseasonSeries, seeds: BracketSeeds): BracketMark | null {
  const winner = series.round === '준플레이오프' ? UNDECIDED : (withSemiPlayoffWinner(series).semiPlayoffWinner ?? UNDECIDED)
  if (winner === UNDECIDED) return null
  const isThirdWon = winner === seeds.b
  return {
    redBoxes: [...boxesOf(isThirdWon ? 54 : 55, 3), { frame: 55, box: 0 }, { frame: 56, box: 0 }],
    darkCells: [isThirdWon ? 1 : 0],
  }
}

/** p != 10: (f, n) = p == b ? (54, 5) : p == a ? (55, 5) : (56, 3) ; f 박스 0..n−1 빨강 ; 56 박스 0 · 57 박스 0 빨강 ; p == c ? 덮기[0] · 덮기[1] : 덮기[2] */
function playoffMarkOf(series: PostseasonSeries, seeds: BracketSeeds): BracketMark | null {
  const winner = series.round === '한국시리즈' || series.round === '종료' ? series.teams[1] : UNDECIDED
  if (winner === UNDECIDED) return null
  const [frame, count] = playoffPathOf(winner, seeds)
  return {
    redBoxes: [...boxesOf(frame, count), { frame: 56, box: 0 }, { frame: 57, box: 0 }],
    darkCells: winner === seeds.c ? [0, 1] : [2],
  }
}

/** PO 승자가 걸어온 선 — 준PO 쪽(3위 54 · 4위 55)은 다섯 박스, 2위(56)는 세 박스 */
function playoffPathOf(winner: number, seeds: BracketSeeds): readonly [LineFrame, number] {
  if (winner === seeds.b) return [54, 5]
  if (winner === seeds.a) return [55, 5]
  return [56, 3]
}

/** L[0x36]: e = L[0x37] ; f = e == a ? 55 : e == b ? 54 : e == c ? 56 : 57 ; f 박스 전부 빨강 ; e == d ? 덮기[0..2] : 덮기[3] */
function finalMarkOf(series: PostseasonSeries, seeds: BracketSeeds): BracketMark | null {
  if (series.round !== '종료') return null
  const frame = championFrameOf(series.champion, seeds)
  return {
    redBoxes: boxesOf(frame, LINE_FRAMES[frame].length),
    darkCells: series.champion === seeds.d ? [0, 1, 2] : [3],
  }
}

/** 우승 팀이 걸어온 선 — 4위 55 · 3위 54 · 2위 56 · 그 밖(1위) 57 */
function championFrameOf(champion: number | null, seeds: BracketSeeds): LineFrame {
  if (champion === seeds.a) return 55
  if (champion === seeds.b) return 54
  if (champion === seeds.c) return 56
  return 57
}
