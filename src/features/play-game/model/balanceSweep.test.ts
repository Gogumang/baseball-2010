import { afterAll, describe, expect, it } from 'vitest'
import { appendFileSync } from 'node:fs'
import { playCareerGames } from '@/features/play-game/model/batterHitRateHarness'
import type { HitRateOptions, HitRateTally } from '@/features/play-game/model/batterHitRateHarness'
import { ORIGINAL_BALANCE_VALUES, setBalanceValuesForTests } from '@/shared/config/balance'
import type { BalanceValues } from '@/shared/config/balance'

/**
 * **숨은 판정값 효과 측정** (r265 — "그것도 어떻게 적용하면 안타나 삼진 같은 확률이 오르는 건가?").
 *
 * `balance.json` 의 주요 항목을 몇 단계로 바꿔 가며 신인 타자(나리 1년차, 사기 100)의 헛스윙률 · 타율 · 삼진률 · 홈런률을
 * 잰다. 하네스는 r209 · r242 타율 시험과 같다(`batterHitRateHarness`) — 모든 공에 스윙, 키 틱은 N − 3 · N − 2 · N − 1 중
 * 하나를 고른다("보통 타이밍"). 결과는 docs `docs/re/BALANCE.md` 에 옮겼다.
 *
 * 무거우니 평소에는 건너뛴다. `BALANCE_SWEEP=<결과 파일>` 을 주면 돌고 한 줄씩 JSON 으로 적는다.
 */
const OUTPUT = process.env.BALANCE_SWEEP
const GAMES = Number(process.env.BALANCE_SWEEP_GAMES ?? 300)
const NORMAL_TIMING = [-1, 0, 1]

interface SweepRow {
  readonly id: string
  readonly label: string
  readonly isOriginal: boolean
  readonly whiffRate: number
  readonly battingAverage: number
  readonly strikeoutRate: number
  readonly homeRunRate: number
  readonly atBats: number
}

const ratio = (part: number, whole: number) => (whole === 0 ? 0 : Math.round((part / whole) * 1000) / 1000)

function measure(
  id: string,
  label: string,
  overrides: Partial<BalanceValues>,
  isOriginal: boolean,
  options: Omit<HitRateOptions, 'games'> = {},
): SweepRow {
  setBalanceValuesForTests({ ...ORIGINAL_BALANCE_VALUES, ...overrides })
  const tally: HitRateTally = playCareerGames({ offsets: NORMAL_TIMING, games: GAMES, ...options })
  const row: SweepRow = {
    id,
    label,
    isOriginal,
    whiffRate: ratio(tally.whiffs, tally.swings),
    battingAverage: ratio(tally.hits, tally.atBats),
    strikeoutRate: ratio(tally.strikeouts, tally.atBats),
    homeRunRate: ratio(tally.homeRuns, tally.atBats),
    atBats: tally.atBats,
  }
  if (OUTPUT !== undefined) appendFileSync(OUTPUT, `${JSON.stringify(row)}\n`)
  return row
}

const scaled = (values: readonly number[], factor: number) => values.map((value) => Math.round(value * factor))

describe.skipIf(OUTPUT === undefined)('숨은 판정값 효과 측정 (BALANCE_SWEEP)', { timeout: 600_000 }, () => {
  afterAll(() => setBalanceValuesForTests(ORIGINAL_BALANCE_VALUES))

  it('원본 기준 — 보통 타이밍 · 최적 타이밍', () => {
    measure('base', '원본 (보통 타이밍 N−3~N−1)', {}, true)
    measure('base', '원본 (최적 타이밍 N−2)', {}, true, { offsets: [0] })
  })

  it('내 선수 타자 보너스', () => {
    for (const value of [0, 200, 400, 600, 800]) {
      measure('swing.ownBatterBonusBase', String(value), { 'swing.ownBatterBonusBase': value }, value === 400)
    }
  })

  it('내 선수 보너스 연차당 감소 — 7년차(연차 idx 6)', () => {
    for (const value of [0, 20, 35, 50, 67]) {
      measure('swing.ownBatterBonusPerYear', `${value} (7년차 보너스 ${Math.max(0, 400 - value * 6)})`,
        { 'swing.ownBatterBonusPerYear': value }, value === 35, { careerYearIndex: 6 })
    }
  })

  it('맞힐 확률 기본값', () => {
    for (const value of [600, 900, 1200, 1500, 1800]) {
      measure('swing.contactBase', String(value), { 'swing.contactBase': value }, value === 1200)
    }
  })

  it('타이밍 폭', () => {
    for (const value of [12, 18, 24, 36, 48]) {
      measure('timing.width', String(value), { 'timing.width': value }, value === 24)
    }
  })

  it('타이밍 중심', () => {
    for (const value of [57, 67, 77, 87, 97]) {
      measure('swing.timingPivot', String(value), { 'swing.timingPivot': value }, value === 77)
    }
  })

  it('스윙 세기 보너스', () => {
    for (const value of [0, 250, 500, 1000, 2000]) {
      measure('swing.swingStrengthBonus', String(value), { 'swing.swingStrengthBonus': value }, value === 500)
    }
  })

  it('홈런성 기본(나리)', () => {
    for (const value of [0, 35, 70, 140, 280]) {
      measure('swing.aceExtraBase', String(value), { 'swing.aceExtraBase': value }, value === 70)
    }
  })

  it('약한 타구 중 파울 %', () => {
    for (const value of [10, 20, 30, 45, 60]) {
      measure('swing.foulPercent', String(value), { 'swing.foulPercent': value }, value === 30)
    }
  })

  it('사기 구간 감소 — 사기 25 (31~ 구간 아래 · 11~30 구간)', () => {
    for (const cut of [0, 10, 20, 40, 60]) {
      measure('ability.moraleCuts', `11~30 구간 ${cut}%`, { 'ability.moraleCuts': [[10, 50], [30, cut], [50, 10]] }, cut === 20,
        { careerPatch: { morale: 25 } })
    }
  })

  it('CPU 투수 제구 흩어짐 계수', () => {
    const original = ORIGINAL_BALANCE_VALUES['pitching.controlErrorCoefficients'] as readonly number[]
    for (const factor of [0.5, 1, 1.5, 2]) {
      measure('pitching.controlErrorCoefficients', `×${factor} [${scaled(original, factor).join(',')}]`,
        { 'pitching.controlErrorCoefficients': scaled(original, factor) }, factor === 1)
    }
  })

  it('측정 뒤 원본으로 돌아간다', () => {
    setBalanceValuesForTests(ORIGINAL_BALANCE_VALUES)
    const row = measure('base', '원본 (다시)', {}, true)
    expect(row.atBats).toBeGreaterThan(0)
  })
})
