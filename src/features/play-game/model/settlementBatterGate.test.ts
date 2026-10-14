import { describe, expect, it } from 'vitest'
import { EMPTY_BASES } from '@/entities/game/model/baseState'
import { lineupSlotOf } from '@/entities/game/model/quickLineup'
import { runDefensePlay } from '@/features/defense-play/model/runDefensePlay'
import type { DefensePlayResult } from '@/features/defense-play/model/runDefensePlay'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { resolveDefensePlay, startGame, startPlayerOutcome, summaryOf } from '@/features/play-game/model/gameFlow'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

/** 기록 1 솔로 홈런 (0xa8024 홈런 갈래 a8642) */
const SOLO_HOME_RUN_RECORD = 1
/** 기록 6 백투백 (0xa794c) */
const BACK_TO_BACK_RECORD = 6

function 내타석(): GameProgress {
  const progress = startGame(createSeededRandom(20100901))
  return { ...progress, game: { ...progress.game, bases: EMPTY_BASES, outs: 0, half: '말' } }
}

/** 빈 루 · 무사에서 친 타구 판을 붙들고, 판 끝 결과를 원하는 꼴로 갈아 끼운다 */
function 붙든판(overrides: Partial<DefensePlayResult>): { progress: GameProgress; result: DefensePlayResult } {
  const started = startPlayerOutcome(내타석(), { kind: '안타', bases: 1 }, createSeededRandom(3))
  // 패턴 없이 연 판은 넘겨받은 결과를 적는다(`outcomeIsGiven`) — 판 끝 정산 결과를 적는 실제 길로 되돌린다
  const progress = { ...started, pendingDefensePlay: { ...started.pendingDefensePlay!, outcomeIsGiven: false } }
  const played = runDefensePlay(progress.pendingDefensePlay)
  return { progress, result: { ...played, ...overrides } }
}

/** 타자주자가 판 안에서 홈을 밟은 장내 홈런 (state[0x25] — 사건 8 없음) */
const 장내홈런: Partial<DefensePlayResult> = {
  outcome: { kind: '홈런' },
  groundHomeRun: true,
  advance: { bases: EMPTY_BASES, runsScored: 1, outsAdded: 0 },
}

/** 내 타순 칸 기록(team+0x34+타순·0x18)의 홈런 +0x13 — 판을 먹인 뒤 동료 타석이 돌아도 내 칸은 그대로다 */
const 내칸홈런 = (before: GameProgress, after: GameProgress) =>
  after.ourLineup.records[lineupSlotOf(before.game.battingOrderIndex)]?.homeRuns ?? 0

/** 같은 씨앗으로 두 게이트를 다 돌린다 — 판 뒤 동료 · 상대 타석은 게이트와 무관해 같은 난수로 같게 돈다 */
function 둘다(overrides: Partial<DefensePlayResult>, streak = 0) {
  const { progress, result } = 붙든판(overrides)
  const 시작 = { ...progress, homeRunStreak: streak }
  const 정규 = resolveDefensePlay(시작, result, createSeededRandom(4), { isRecorded: true })
  const 포스트 = resolveDefensePlay(시작, result, createSeededRandom(4), { isRecorded: false })
  const count = (ids: readonly number[], id: number) => ids.filter((x) => x === id).length
  return { 시작, 정규, 포스트, count }
}

describe('정산 0xa8024 의 타자 게이트 [sp+0x34] — 포스트시즌 장내 홈런 (a84d6)', () => {
  it('게이트가 거짓이면 루타 4 안타로만 적혀 홈런 갈래(기록 1~4 · +0x13)를 건너뛴다', () => {
    const { 시작, 정규, 포스트, count } = 둘다(장내홈런)

    expect(내칸홈런(시작, 정규)).toBe(1)
    expect(내칸홈런(시작, 포스트)).toBe(0)
    expect(count(정규.recordIds, SOLO_HOME_RUN_RECORD) - count(포스트.recordIds, SOLO_HOME_RUN_RECORD)).toBe(1)
    // 이 경기 기록은 결과 링(코드 4)처럼 그대로 센다 — 포스트시즌 레코드 줄은 `withoutRecordLine` 이 뺀다
    expect(포스트.myStats.homeRuns).toBe(정규.myStats.homeRuns)
    expect(포스트.myStats.hits).toBe(정규.myStats.hits)
  })

  it('안타 갈래 a86b4 가 ctx+0x162 를 0 으로 둬 백투백 6 이 안 나온다', () => {
    const { 정규, 포스트, count } = 둘다(장내홈런, 1)

    expect(count(정규.recordIds, BACK_TO_BACK_RECORD) - count(포스트.recordIds, BACK_TO_BACK_RECORD)).toBe(1)
  })

  it('담장을 넘긴 홈런(사건 8)은 게이트와 무관하게 홈런 갈래를 지난다', () => {
    const { 시작, 정규, 포스트 } = 둘다({ ...장내홈런, groundHomeRun: false })

    expect(내칸홈런(시작, 포스트)).toBe(1)
    expect(포스트.recordIds).toEqual(정규.recordIds)
  })
})

describe('번트 안타 G+0xf4 — 정산 a8506 (안타 갈래 · 번트 타구 state[0x13] → 코드 10)', () => {
  it('번트 타구가 안타로 끝나면 경기 요약의 reputationCounts.buntHits 로 나간다', () => {
    const { progress, result } = 붙든판({ outcome: { kind: '안타', bases: 1 }, buntBall: true })
    const 끝 = resolveDefensePlay(progress, result, createSeededRandom(4), { isRecorded: true })

    expect(summaryOf(끝).reputationCounts.buntHits).toBe(1)
  })

  it('희생번트(아웃)는 안타 갈래를 안 지나 안 센다', () => {
    const { progress, result } = 붙든판({ outcome: { kind: '아웃', detail: '땅볼아웃' }, buntBall: true })
    const 끝 = resolveDefensePlay(progress, result, createSeededRandom(4), { isRecorded: true })

    expect(summaryOf(끝).reputationCounts.buntHits).toBe(0)
  })

  it('번트가 아닌 안타는 안 센다', () => {
    const { progress, result } = 붙든판({ outcome: { kind: '안타', bases: 1 } })
    const 끝 = resolveDefensePlay(progress, result, createSeededRandom(4), { isRecorded: true })

    expect(summaryOf(끝).reputationCounts.buntHits).toBe(0)
  })

  it('게이트 0xa56dc(R, 타자, 1) 가 거짓(포스트시즌 · 국가대항전)이면 안 센다', () => {
    const { progress, result } = 붙든판({ outcome: { kind: '안타', bases: 1 }, buntBall: true })
    const 끝 = resolveDefensePlay(progress, result, createSeededRandom(4), { isRecorded: false })

    expect(summaryOf(끝).reputationCounts.buntHits).toBe(0)
  })
})
