import type { GameEndDecision } from '@/entities/game/model/winLossSave'

/**
 * **사람 경기의 투수 줄** — 원본은 사람 경기도 CPU 끼리 경기와 같은 정산 `0xa8024`(타석마다)·투구 `0xa5e14`·경기 끝
 * `0xa7de8` 을 불러 투수 레코드(+0x20 아웃 · +0x22 실점 · +0x26 탈삼진 · +0x28 투구 수 · +0x2e 승 · +0x2f 패)를 올린다
 * (P1 6절 · 27da3c7). 진행기가 경기 동안 투수마다 줄을 모으고 요약에 실어 보내면, 부르는 쪽이 리그 기록표
 * (`leaguePitcherAppearancesOf` → `recordLeaguePitcherAppearances`)에 쌓는다.
 *
 * - 아웃: 0xa8cca~0xa8ce4 가 이번 플레이의 결과 코드 5(삼진)·0xd(아웃) 수를 더한다 — 웹은 그 플레이로 늘어난 아웃 수.
 * - 실점: 원본 0xa8ee4 는 홈을 밟은 주자에 적힌 **그 주자를 내보낸 투수**(주자+0x30)에게 매긴다. 웹 주자는 신원을 들고
 *   있지 않아 그 순간 마운드 투수에게 매긴다 — 반 이닝 엔진(`HalfInningPitcherLine`)과 같은 **근사다**.
 * - 투구 수: 그 투수 마운드의 `pitches`(+0x27c) — 교체·경기 끝에 얹는다.
 */
export interface GamePitcherLine {
  readonly teamId: number
  /** 붙박이 표 투수 칸 (0~7) */
  readonly pitcherSlot: number
  readonly outs: number
  readonly runsAllowed: number
  readonly strikeouts: number
  readonly pitches: number
}

/** 경기 요약에 싣는 리그 투수 재료 */
export interface GameLeaguePitchers {
  /** 이 경기를 던진 투수 줄 — 내 육성 선수는 뺀다 */
  readonly lines: readonly GamePitcherLine[]
  /** 경기 끝 판정 0xa7de8 (`gameEndDecisionOf`) — 측·등번호(= 붙박이 표 칸) */
  readonly decision: GameEndDecision
  /** state 칸(측 0 = 초 공격 · 1 = 말 공격) → 그 측 팀 번호. 판정 받은 투수는 그 측 팀의 투수다 */
  readonly sideTeams: readonly [number, number]
  /**
   * 판정 받은 투수의 **붙박이 표 팀**이 측의 팀과 다를 때만 — 트레이드로 다른 팀 레코드에 옮겨 간 투수(원본 id 가 옛 팀
   * Xls 행이라 기록이 그 자리로 쌓인다). 줄(`lines`)의 `teamId` 는 이미 그 표 팀이다. 없는 칸은 `sideTeams[측]`.
   */
  readonly decisionTableTeams?: {
    readonly winner?: number
    readonly loser?: number
    readonly save?: number
  }
}

/** 줄 하나에 더한다 — 없으면 새로 만든다 (나온 차례대로) */
export function chargePitcherLine(
  lines: readonly GamePitcherLine[],
  teamId: number,
  pitcherSlot: number,
  delta: Partial<Pick<GamePitcherLine, 'outs' | 'runsAllowed' | 'strikeouts' | 'pitches'>>,
): readonly GamePitcherLine[] {
  const outs = delta.outs ?? 0
  const runsAllowed = delta.runsAllowed ?? 0
  const strikeouts = delta.strikeouts ?? 0
  const pitches = delta.pitches ?? 0
  const index = lines.findIndex((line) => line.teamId === teamId && line.pitcherSlot === pitcherSlot)
  if (index < 0) return [...lines, { teamId, pitcherSlot, outs, runsAllowed, strikeouts, pitches }]
  return lines.map((line, at) =>
    at === index
      ? {
          ...line,
          outs: line.outs + outs,
          runsAllowed: line.runsAllowed + runsAllowed,
          strikeouts: line.strikeouts + strikeouts,
          pitches: line.pitches + pitches,
        }
      : line,
  )
}

/** 반 이닝 엔진 줄(`HalfInningPitcherLine`)들을 한 팀 몫으로 얹는다 */
export function chargeHalfInningLines(
  lines: readonly GamePitcherLine[],
  teamId: number,
  halfLines: readonly {
    readonly pitcherSlot: number
    readonly outs: number
    readonly runsAllowed: number
    readonly strikeouts: number
    readonly pitches: number
  }[],
): readonly GamePitcherLine[] {
  return halfLines.reduce(
    (current, line) =>
      chargePitcherLine(current, teamId, line.pitcherSlot, {
        outs: line.outs,
        runsAllowed: line.runsAllowed,
        strikeouts: line.strikeouts,
        pitches: line.pitches,
      }),
    lines,
  )
}

/** 한 타석·플레이로 늘어난 아웃 — 반 이닝이 넘어갔으면 그 반 이닝의 남은 아웃(3 − 앞 아웃) */
export function outsAddedBetween(
  before: { readonly inning: number; readonly half: string; readonly outs: number },
  after: { readonly inning: number; readonly half: string; readonly outs: number; readonly isFinished?: boolean },
): number {
  const sameHalf = before.inning === after.inning && before.half === after.half
  if (sameHalf) return Math.max(0, after.outs - before.outs)
  return Math.max(0, 3 - before.outs)
}
