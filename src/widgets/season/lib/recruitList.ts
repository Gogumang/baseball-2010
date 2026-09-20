import {
  hasRecruitedCareerPlayer, hasRecruitedHallOfFamePlayer, recruitSourceOf, recruitsPitcher,
} from '@/entities/season-mode/model/playerRecruit'
import type {
  RecruitRefusal, RecruitSourceKind, SeasonPlayer, SeasonTeamRoster,
} from '@/entities/season-mode/model/playerRecruit'

/**
 * 선수영입 목록 만들기 — 칸 배치와 중복 검사는 `entities/season-mode/model/playerRecruit.ts` 가 가진다
 * (`docs/re/R13-season-leftovers.md` 9절 · `docs/re/P4-season-flow.md` 5절 확정).
 *
 * 칸 배치: **0 = 나리 투수 · 1~4 = 명예 투수 · 5 = 나리 타자 · 6~ = 명예 타자**.
 * 쪽(투수/타자)은 `k > 4` 로 갈린다.
 */

/**
 * 명예의 전당 칸 수 — **투수 4칸 · 타자 8칸**.
 * R13 9절: "명예의 전당은 투수 2칸·타자 4칸, 슬롯 구매로 4·8". 커서 배치가 1~4(투수)·6~(타자)라
 * 목록은 늘 최대 칸 수로 그리고 비어 있는 칸은 빈 줄로 둔다 (**근사** — 목록을 채우는 원본 코드는 안 읽혔다).
 */
export const HALL_OF_FAME_PITCHER_SLOTS = 4
export const HALL_OF_FAME_BATTER_SLOTS = 8

/** 영입 후보 한 명. `player` 는 그대로 `recruitPlayer` 에 넘길 원본 기록이다 */
export interface RecruitCandidate {
  readonly name: string
  readonly player: SeasonPlayer
}

export interface RecruitListInput {
  /** 나만의리그 투수 기록 `0x22168(저장)` */
  readonly careerPitcher: RecruitCandidate | null
  /** 나만의리그 타자 기록 `0x220ec(저장)` */
  readonly careerBatter: RecruitCandidate | null
  /** 명예의 전당 투수 `0x1f62c(저장, i)` — 최대 4칸 */
  readonly hallOfFamePitchers: readonly (RecruitCandidate | null)[]
  /** 명예의 전당 타자 `0x1f640(저장, i)` — 최대 8칸 */
  readonly hallOfFameBatters: readonly (RecruitCandidate | null)[]
}

export interface RecruitListEntry {
  /** 원본 커서 칸 번호 k */
  readonly cursor: number
  readonly source: RecruitSourceKind
  /** `k <= 4` 이면 투수 쪽 */
  readonly isPitcher: boolean
  readonly candidate: RecruitCandidate | null
  /** 중복이면 StrMODE[181] "이미 영입된 선수 입니다" */
  readonly refusal: RecruitRefusal | null
}

const padded = (
  list: readonly (RecruitCandidate | null)[],
  length: number,
): readonly (RecruitCandidate | null)[] =>
  Array.from({ length }, (_, index) => list[index] ?? null)

/**
 * 목록 한 벌. 줄 순서가 곧 원본 커서 칸이라 `recruitSourceOf` 와 어긋날 수 없다.
 *
 * 중복 검사는 원본과 같은 두 가지다 (P4 5절):
 *   나리 선수 `0xb5054(팀, 쪽)` — 팀에 **한 명씩만** (판정은 `+0xa < 0`)
 *   명예 선수 `0xb50ac(팀, 쪽, i)` — 같은 선수 번호가 이미 있는가
 */
export function recruitEntriesOf(input: RecruitListInput, roster: SeasonTeamRoster): RecruitListEntry[] {
  const candidates: readonly (RecruitCandidate | null)[] = [
    input.careerPitcher,
    ...padded(input.hallOfFamePitchers, HALL_OF_FAME_PITCHER_SLOTS),
    input.careerBatter,
    ...padded(input.hallOfFameBatters, HALL_OF_FAME_BATTER_SLOTS),
  ]

  return candidates.map((candidate, cursor) => {
    const source = recruitSourceOf(cursor)
    const isPitcher = recruitsPitcher(cursor)
    const players = isPitcher ? roster.pitchers : roster.batters
    const duplicated =
      candidate === null
        ? false
        : source === '나리투수' || source === '나리타자'
          ? hasRecruitedCareerPlayer(players)
          : hasRecruitedHallOfFamePlayer(players, candidate.player.id)
    return { cursor, source, isPitcher, candidate, refusal: duplicated ? '이미영입' : null }
  })
}
