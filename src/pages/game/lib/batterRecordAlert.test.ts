import { describe, expect, it } from 'vitest'
import { startGame } from '@/features/play-game/model/gameFlow'
import type { GameProgress } from '@/features/play-game/model/gameFlow'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import {
  RESULT_WAIT_TICKS, RESULT_WAIT_TICKS_AT_BAT_END, batterHumanRecordCountOf, myAtBatRecordCountOf, resultWaitTicksOf,
} from '@/pages/game/lib/batterRecordAlert'

const base = startGame(createSeededRandom(20101007))

const withStats = (progress: GameProgress, patch: Partial<GameProgress['myStats']>, rest: Partial<GameProgress> = {}) => ({
  ...progress,
  ...rest,
  myStats: { ...progress.myStats, ...patch },
})

describe('0x12 대기 틱 (0x4e6de~0x4e6f0)', () => {
  it('st[0xb] 가 3 볼넷 · 4 사구 · 5 삼진이면 31, 아니면 15', () => {
    expect(RESULT_WAIT_TICKS).toBe(15)
    expect(RESULT_WAIT_TICKS_AT_BAT_END).toBe(31)
    expect(resultWaitTicksOf({ kind: '볼넷' })).toBe(31)
    expect(resultWaitTicksOf({ kind: '사구' })).toBe(31)
    expect(resultWaitTicksOf({ kind: '삼진' })).toBe(31)
    expect(resultWaitTicksOf(null)).toBe(15)
  })
})

describe('타자편 공 끝 몫 — 내 공 몫만 이번에, 자동 타석 몫은 다음 공 끝에', () => {
  it('타석이 안 끝났으면 내 타석 몫은 0 — 앞의 도루 8 · 연속 파울 32/33 만 이번 몫이다', () => {
    expect(myAtBatRecordCountOf(base, base)).toBe(0)
    expect(batterHumanRecordCountOf(base, base, [8, 32, 0, 16])).toBe(2)
  })

  it('3루타 타석은 기록 0 하나 — 그 뒤 동료 타석 몫은 남긴다', () => {
    const after = withStats(base, {
      plateAppearances: base.myStats.plateAppearances + 1,
      atBats: base.myStats.atBats + 1,
      hits: base.myStats.hits + 1,
      triples: base.myStats.triples + 1,
    }, { consecutiveHits: base.consecutiveHits + 1 })
    expect(myAtBatRecordCountOf(base, after)).toBe(1)
    expect(batterHumanRecordCountOf(base, after, [32, 0, 0, 1])).toBe(2)
  })

  it('만루 홈런 + 앞 타석 홈런이면 홈런 단계 · 백투백까지 내 몫이다', () => {
    const before = { ...base, homeRunStreak: 1 }
    const after = withStats(before, {
      plateAppearances: base.myStats.plateAppearances + 1,
      atBats: base.myStats.atBats + 1,
      hits: base.myStats.hits + 1,
      homeRuns: base.myStats.homeRuns + 1,
      runsBattedIn: base.myStats.runsBattedIn + 4,
    }, { consecutiveHits: base.consecutiveHits + 1, homeRunStreak: 2 })
    // 만루 홈런(4) · 백투백(6)
    expect(myAtBatRecordCountOf(before, after)).toBe(2)
  })

  it('아웃 · 삼진 · 사구 타석은 0', () => {
    const after = withStats(base, {
      plateAppearances: base.myStats.plateAppearances + 1,
      atBats: base.myStats.atBats + 1,
      strikeouts: base.myStats.strikeouts + 1,
    })
    expect(myAtBatRecordCountOf(base, after)).toBe(0)
    expect(batterHumanRecordCountOf(base, after, [16, 17])).toBe(0)
  })
})

describe('진행기와 맞춰 보기 — 내 타석 몫이 recordIds 앞쪽에 그대로 있다', () => {
  it('홈런 · 볼넷만 쳐 나가도(수비 판이 안 서는 결과) 앞쪽 몫이 내 타석 정산 그대로다', async () => {
    const { applyPlayerOutcome } = await import('@/features/play-game/model/gameFlow')
    const { recordBatterAtBat } = await import('@/entities/game/model/batterGameLog')
    const { backToBackRecordOf } = await import('@/entities/game/model/gameRecords')
    const random = createSeededRandom(7)
    let progress = startGame(random)
    const outcomes = [{ kind: '홈런' }, { kind: '홈런' }, { kind: '볼넷' }, { kind: '볼넷' }, { kind: '홈런' }] as const
    let checked = 0
    for (const outcome of outcomes) {
      if (progress.game.isFinished) break
      const before = progress
      progress = applyPlayerOutcome(before, outcome, random)
      const added = progress.recordIds.slice(before.recordIds.length)
      const rbi = progress.myStats.runsBattedIn - before.myStats.runsBattedIn
      const mine = [
        ...recordBatterAtBat({ stats: before.myStats, consecutiveHits: before.consecutiveHits }, outcome, rbi).recordIds,
        ...backToBackRecordOf({ streak: before.homeRunStreak, humanOffense: true, isHomeRun: outcome.kind === '홈런' })
          .recordIds,
      ]
      const count = batterHumanRecordCountOf(before, progress, added)
      expect(count).toBe(mine.length)
      expect(added.slice(0, count)).toEqual(mine)
      checked += 1
    }
    expect(checked).toBeGreaterThan(2)
  })
})
