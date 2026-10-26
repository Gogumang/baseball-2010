import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import rawConfig from '@/shared/config/balance/balance.json'
import {
  BALANCE_CONFIG,
  BALANCE_JSON_VALUES,
  ORIGINAL_BALANCE_VALUES,
  activeBalanceValues,
  balanceGrid,
  balanceList,
  balanceNumber,
  parseBalanceConfig,
  setBalanceValuesForTests,
} from '@/shared/config/balance'
import type { BalanceCategory } from '@/shared/config/balance'
import { D_LEVEL_RAW } from '@/shared/config/original/dLevel'

afterEach(() => setBalanceValuesForTests(ORIGINAL_BALANCE_VALUES))

const u16 = (offset: number) => D_LEVEL_RAW[offset] | (D_LEVEL_RAW[offset + 1] << 8)

describe('balance.json 모양', () => {
  it('TS 타입 검사를 통과하고 항목마다 이름 · 근거 · 효과 · 범위가 있다', () => {
    const config = parseBalanceConfig(rawConfig)
    expect(config.entries.length).toBe(Object.keys(ORIGINAL_BALANCE_VALUES).length)
    for (const entry of config.entries) {
      expect(entry.name, entry.id).not.toBe('')
      expect(entry.effect.length, entry.id).toBeGreaterThan(10)
      expect(entry.source, entry.id).toMatch(/0x[0-9a-f]+/)
    }
  })

  it('**기본값이 원본과 같다** — 항목마다 견준다', () => {
    for (const entry of BALANCE_CONFIG.entries) {
      expect(entry.value, entry.id).toEqual(ORIGINAL_BALANCE_VALUES[entry.id])
    }
    expect(BALANCE_JSON_VALUES).toEqual(ORIGINAL_BALANCE_VALUES)
  })

  it('d_level.dat 에서 오는 값은 근거 오프셋의 바이트와 같다', () => {
    const fileValueOf = (id: string) => {
      const source = BALANCE_CONFIG.entries.find((entry) => entry.id === id)?.source ?? ''
      const offset = Number.parseInt(/d_level\.dat (0x[0-9a-f]+)/.exec(source)?.[1] ?? 'NaN', 16)
      return offset
    }
    const u16Ids = [
      'timing.floor', 'timing.scale', 'swing.ownBatterBonusBase', 'swing.ownBatterBonusPerYear', 'swing.ownPitcherBonusBase',
      'swing.ownPitcherBonusPerYear', 'swing.normalContactFactor', 'swing.aceContactFactor', 'swing.normalHitBase',
      'swing.normalHitCoefficient', 'swing.normalExtraBase', 'swing.normalExtraCoefficient', 'swing.aceHitBase',
      'swing.aceHitCoefficient', 'swing.aceExtraBase', 'swing.aceExtraCoefficient', 'pitching.wildPitchPermyriad',
      'fielding.throwSpeedBase', 'fielding.throwSpeedPerGrade', 'running.baseSpeed', 'running.speedPerRun',
    ] as const
    for (const id of u16Ids) expect(u16(fileValueOf(id)), id).toBe(ORIGINAL_BALANCE_VALUES[id])
    for (const id of ['swing.hitWeight', 'swing.extraWeight', 'swing.timingPivot', 'swing.foulPercent', 'swing.outPercent'] as const) {
      expect(D_LEVEL_RAW[fileValueOf(id)], id).toBe(ORIGINAL_BALANCE_VALUES[id])
    }
  })

  it('기본값은 범위 안이다', () => {
    for (const entry of BALANCE_CONFIG.entries) {
      const leaves = typeof entry.value === 'number' ? [entry.value] : entry.value.flat()
      for (const leaf of leaves) {
        expect(leaf, entry.id).toBeGreaterThanOrEqual(entry.range.min)
        expect(leaf, entry.id).toBeLessThanOrEqual(entry.range.max)
      }
    }
  })

  it('모든 항목을 판정 코드가 읽는다 — 표에만 있고 안 쓰이는 값이 없다', () => {
    const sourceFiles = (directory: string): string[] =>
      readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
        const path = join(directory, entry.name)
        if (entry.isDirectory()) return path.endsWith(join('shared', 'config', 'balance')) ? [] : sourceFiles(path)
        return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : []
      })
    const code = sourceFiles(fileURLToPath(new URL('../../..', import.meta.url)))
      .map((path) => readFileSync(path, 'utf8'))
      .join('\n')
    for (const id of Object.keys(ORIGINAL_BALANCE_VALUES)) expect(code.includes(`'${id}'`), id).toBe(true)
  })

  it('범주별 항목 수', () => {
    const counts = BALANCE_CONFIG.entries.reduce<Partial<Record<BalanceCategory, number>>>(
      (acc, entry) => ({ ...acc, [entry.category]: (acc[entry.category] ?? 0) + 1 }), {},
    )
    expect(counts).toEqual({ timing: 6, swing: 32, skill: 2, ability: 6, pitching: 12, fielding: 5, running: 2 })
  })

  it('틀린 모양은 막는다', () => {
    const entryOf = (patch: Record<string, unknown>) => ({
      id: 'timing.width', category: 'timing', name: 'n', value: 24, source: '0x1', effect: 'e', range: { min: 1, max: 200 }, ...patch,
    })
    const configOf = (patch: Record<string, unknown>) => ({
      entries: [
        ...(rawConfig.entries as unknown[]).filter((entry) => (entry as { id: string }).id !== 'timing.width'),
        entryOf(patch),
      ],
    })
    expect(() => parseBalanceConfig(configOf({}))).not.toThrow()
    expect(() => parseBalanceConfig(null)).toThrow()
    expect(() => parseBalanceConfig(configOf({ id: 'timing.nothing' }))).toThrow(/모른다/)
    expect(() => parseBalanceConfig(configOf({ value: '24' }))).toThrow(/수여야/)
    expect(() => parseBalanceConfig(configOf({ value: 0 }))).toThrow(/범위/)
    expect(() => parseBalanceConfig(configOf({ category: 'luck' }))).toThrow(/category/)
    expect(() => parseBalanceConfig({ entries: [entryOf({})] })).toThrow(/빠졌다/)
    const list = rawConfig.entries.map((entry) =>
      entry.id === 'fielding.fumblePermyriad' ? { ...entry, value: [200, 180] } : entry,
    )
    expect(() => parseBalanceConfig({ entries: list })).toThrow(/칸 8 개/)
  })
})

describe('읽기', () => {
  it('시험 준비 파일은 원본 값으로 돈다', () => {
    expect(activeBalanceValues()).toEqual(ORIGINAL_BALANCE_VALUES)
    expect(balanceNumber('swing.contactBase')).toBe(1200)
    expect(balanceList('fielding.fumblePermyriad')).toEqual([200, 180, 160, 140, 120, 100, 80, 50])
    expect(balanceGrid('ability.moraleCuts')).toEqual([[10, 50], [30, 20], [50, 10]])
  })

  it('일부만 넘기면 원본 위에 덮고, null 이면 JSON 으로 돌아간다', () => {
    setBalanceValuesForTests({ 'swing.contactBase': 1500 })
    expect(balanceNumber('swing.contactBase')).toBe(1500)
    expect(balanceNumber('timing.width')).toBe(24)
    setBalanceValuesForTests(null)
    expect(activeBalanceValues()).toBe(BALANCE_JSON_VALUES)
  })
})
