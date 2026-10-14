import { describe, expect, it } from 'vitest'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import { PLAYER_SIDE_FIRST_BAT } from '@/entities/game/model/gameState'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { TeamGameOptions, TeamGameProgress } from '@/features/play-team-game/model/teamGameFlow'
import { resolveDefensePlay, startBatterOutcome, startTeamGame } from '@/features/play-team-game/model/teamGameFlow'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

/** 기록 1 솔로 홈런 (0xa8024 홈런 갈래 a8642) · 6 백투백 (0xa794c) */
const SOLO_HOME_RUN_RECORD = 1
const BACK_TO_BACK_RECORD = 6

const 기본옵션: TeamGameOptions = { mode: 2, ourTeamId: 0, opponentTeamId: 1, playerSide: PLAYER_SIDE_FIRST_BAT }

/** 빈 루 · 무사 우리 타석에서 친 타구 판을 붙들고, 판 끝 결과를 원하는 꼴로 갈아 끼운다 */
function 붙든판(
  options: Partial<TeamGameOptions>,
  overrides: Partial<DefensePlayResult>,
  streak = 0,
): { progress: TeamGameProgress; result: DefensePlayResult } {
  const begun = startTeamGame({ ...기본옵션, ...options }, createSeededRandom(20100901))
  const 내타석: TeamGameProgress = {
    ...begun,
    game: { ...begun.game, bases: EMPTY_BASES, outs: 0 },
    recordTally: { ...begun.recordTally, homeRunStreak: streak },
  }
  const started = startBatterOutcome(내타석, { kind: '안타', bases: 1 }, createSeededRandom(3))
  const pending = started.pendingDefensePlay
  if (pending === null) throw new Error('판이 안 열렸다')
  const progress = { ...started, pendingDefensePlay: { ...pending, input: { ...pending.input, outcomeIsGiven: false } } }
  const played = runDefensePlay(progress.pendingDefensePlay.input)
  return { progress, result: { ...played, ...overrides } }
}

const 장내홈런: Partial<DefensePlayResult> = {
  outcome: { kind: '홈런' },
  groundHomeRun: true,
  advance: { bases: EMPTY_BASES, runsScored: 1, outsAdded: 0 },
}

const 칸홈런 = (before: TeamGameProgress, after: TeamGameProgress) =>
  after.ourEntryRecords[before.game.battingOrderIndex]?.homeRuns ?? 0
const 센수 = (ids: readonly number[], id: number) => ids.filter((x) => x === id).length

function 풀기(options: Partial<TeamGameOptions>, overrides: Partial<DefensePlayResult>, streak = 0) {
  const { progress, result } = 붙든판(options, overrides, streak)
  return { 시작: progress, 끝: resolveDefensePlay(progress, result, createSeededRandom(4)) }
}

describe('팀 경기 정산 타자 게이트 [sp+0x34] = 0xa56dc(ctx, 지금 타자, 0) — 장내 홈런 (a84d6)', () => {
  it('시즌 정규 경기는 장내 홈런도 홈런 갈래(기록 1 · 타순 칸 +0x13)를 지난다', () => {
    const { 시작, 끝 } = 풀기({}, 장내홈런)
    expect(칸홈런(시작, 끝)).toBe(1)
    expect(센수(끝.recordIds, SOLO_HOME_RUN_RECORD)).toBe(1)
  })

  it('포스트시즌(SR+0xb4) · 국가대항전(SR+0x12c) · 일반 경기(모드 1 — 0xa56dc 의 모드 갈래 밖)는 루타 4 안타로만 적힌다', () => {
    for (const options of [{ isPostseason: true }, { nationalCupStage: 3 }, { mode: 1 }] as const) {
      const { 시작, 끝 } = 풀기(options, 장내홈런)
      expect(칸홈런(시작, 끝), JSON.stringify(options)).toBe(0)
      expect(센수(끝.recordIds, SOLO_HOME_RUN_RECORD), JSON.stringify(options)).toBe(0)
    }
  })

  it('홈런 갈래를 건너뛴 장내 홈런은 백투백 6 을 안 주고 ctx+0x162 를 0 으로 둔다 (a86b4)', () => {
    const 정규 = 풀기({}, 장내홈런, 1).끝
    const 포스트 = 풀기({ isPostseason: true }, 장내홈런, 1).끝
    expect(센수(정규.recordIds, BACK_TO_BACK_RECORD)).toBe(1)
    expect(센수(포스트.recordIds, BACK_TO_BACK_RECORD)).toBe(0)
  })

  it('담장을 넘긴 홈런(사건 8)은 게이트와 무관하게 홈런 갈래를 지난다 (a80a8)', () => {
    const { 시작, 끝 } = 풀기({ isPostseason: true }, { ...장내홈런, groundHomeRun: false })
    expect(칸홈런(시작, 끝)).toBe(1)
    expect(센수(끝.recordIds, SOLO_HOME_RUN_RECORD)).toBe(1)
  })
})
