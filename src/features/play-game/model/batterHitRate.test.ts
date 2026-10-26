import { describe, expect, it } from 'vitest'
import { playCareerGames } from '@/features/play-game/model/batterHitRateHarness'
import type { HitRateTally } from '@/features/play-game/model/batterHitRateHarness'

/**
 * **나리 타자편 안타율 회귀 시험** (r209 — "타자편 하는데 왤케 안타가 잘 안되지?").
 *
 * 하네스는 `batterHitRateHarness` (r265 밸런스 측정과 같이 쓴다).
 * 타석 판정의 실제 길(CPU 투구 0x344dc · 0x345fc · 0x4dc78 → 스윙 결과 0xab214 · 타이밍 0x34be0 → 방향 · 패턴 → 수비 판
 * → 판 끝 정산 0xa8024)을 신인 타자로 경기 끝까지 돌려 헛스윙률 · 맞힌 페어 타구 안타율 · 타율을 잰다. 모든 공에 스윙한다.
 * 키 틱 F 는 판정 틱(F + 2)이 0x11 안에 드는 범위(F ≤ N − 1)이고 F ≥ N − 3 이라 깊이 관문(4e1e4, 경로 [N − 1])은 늘 열린다.
 * 파울은 판을 돌리지 않고 스트라이크만 올린다(2스트라이크 뒤에는 그대로) — 파울 뜬공 아웃(13)은 세지 않는 근사다.
 *
 * 기준값(2026-10-25 측정, 10-16 r140 · r150 · r170 · r184 · r187 · r205 · main 모두 같은 범위): 최적(F = N − 2) 헛스윙 약 30% ·
 * 타율 약 .25, ±1 틱이면 헛스윙 약 45%. 이 범위를 크게 벗어나면 판정 · 투구 · 수비 판 어딘가가 바뀐 것이다.
 */
describe('나리 타자편 안타율 — 판정 길 회귀 (r209)', () => {
  it('최적 타이밍(F = N − 2) 신인 타자는 헛스윙 약 30% · 맞힌 공 안타율 약 .27 · 타율 약 .25', () => {
    const tally = playCareerGames({ offsets: [0], games: 200 })
    expect(tally.atBats).toBeGreaterThan(700)
    const whiffRate = tally.whiffs / tally.swings
    expect(whiffRate).toBeGreaterThan(0.24)
    expect(whiffRate).toBeLessThan(0.37)
    // r268: 야수 · 주자 한 걸음과 도착 틱이 원본대로 맨해튼 거리(0xbfa2c)라 대각선으로 느려져 맞힌 공 안타율이 .27 → .37 로 올랐다
    expect(tally.hits / tally.fair).toBeGreaterThan(0.3)
    expect(tally.hits / tally.fair).toBeLessThan(0.44)
    expect(tally.hits / tally.atBats).toBeGreaterThan(0.19)
  })

  it('한 틱 빠르거나 늦으면 헛스윙이 는다 — 타이밍 0x34be0 폭 24 · 나눔 N − 1', () => {
    const exact = playCareerGames({ offsets: [0], games: 120 })
    const early = playCareerGames({ offsets: [-1], games: 120 })
    const late = playCareerGames({ offsets: [1], games: 120 })
    const rate = (tally: HitRateTally) => tally.whiffs / tally.swings
    expect(rate(early)).toBeGreaterThan(rate(exact) + 0.05)
    expect(rate(late)).toBeGreaterThan(rate(exact) + 0.05)
  })
})
