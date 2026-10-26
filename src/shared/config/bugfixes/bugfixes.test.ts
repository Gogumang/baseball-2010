import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import rawConfig from '@/shared/config/bugfixes/bugfixes.json'
import {
  BUGFIX_CONFIG,
  IMPLEMENTED_BUGFIX_IDS,
  ORIGINAL_BUGFIX_CONFIG,
  ORIGINAL_BUG_IDS,
  bugfixConfigWith,
  isBugFixed,
  parseBugfixConfig,
  setBugfixConfigForTests,
} from '@/shared/config/bugfixes'
import type { BugfixConfig } from '@/shared/config/bugfixes'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

describe('bugfixes.json 모양', () => {
  it('TS 타입 검사를 통과하고 기본은 모두 고침이다 (사용자 결정 2026-10-26)', () => {
    const config = parseBugfixConfig(rawConfig)
    expect(config.fixAll).toBe(true)
    for (const entry of config.entries) {
      expect(entry.name, entry.id).not.toBe('')
      expect(entry.symptom, entry.id).not.toBe('')
      expect(entry.source, entry.id).not.toBe('')
      expect(entry.fixed, entry.id).toBeNull()
    }
  })

  it('항목 id 가 ORIGINAL-BUGS 1절의 B-01~B-100 · B-106 · B-107 과 1:1 이다', () => {
    expect(BUGFIX_CONFIG.entries.map((entry) => entry.id)).toEqual(ORIGINAL_BUG_IDS)
    expect(ORIGINAL_BUG_IDS).toHaveLength(102)
  })

  it('implemented 가 코드의 고친 길 목록과 1:1 이다', () => {
    const implemented = BUGFIX_CONFIG.entries.filter((entry) => entry.implemented).map((entry) => entry.id)
    expect(implemented).toEqual([...IMPLEMENTED_BUGFIX_IDS])
  })

  /**
   * docs 저장소(`baseball-2010-re/docs/re/ORIGINAL-BUGS.md`)가 옆에 있으면 표의 id·모드·근거가 같은지 본다.
   * 없으면(다른 기계 · CI) 건너뛴다. `BASEBALL_RE_DOCS` 로 docs/re 경로를 줄 수 있다.
   */
  const docsPath = [
    process.env.BASEBALL_RE_DOCS === undefined ? null : resolve(process.env.BASEBALL_RE_DOCS, 'ORIGINAL-BUGS.md'),
    resolve(process.cwd(), '../baseball-2010-re/docs/re/ORIGINAL-BUGS.md'),
    resolve(process.cwd(), '../../baseball-2010-re/docs/re/ORIGINAL-BUGS.md'),
  ].find((path): path is string => path !== null && existsSync(path))

  it.skipIf(docsPath === undefined)('ORIGINAL-BUGS.md 1절 표와 id · 모드 · 근거가 같다', () => {
    const markdown = readFileSync(docsPath as string, 'utf8')
    const section = markdown.split('## 1.')[1]?.split('## 2.')[0] ?? ''
    const rows = section
      .split('\n')
      .filter((line) => /^\| B-\d+ \|/.test(line))
      .map((line) => line.trim().replace(/^\|/, '').replace(/\|$/, '').split(' | ').map((cell) => cell.trim()))
    expect(rows.map((row) => row[0])).toEqual(ORIGINAL_BUG_IDS)
    for (const [index, row] of rows.entries()) {
      const entry = BUGFIX_CONFIG.entries[index]
      expect(entry?.name, row[0]).toBe(row[1])
      expect(entry?.source, row[0]).toBe(row[3])
    }
  })

  it('틀린 모양은 막는다', () => {
    expect(() => parseBugfixConfig(null)).toThrow()
    expect(() => parseBugfixConfig({ fixAll: 'yes', entries: [] })).toThrow(/fixAll/)
    const entry = { id: 'B-01', name: 'n', symptom: 's', source: '0x1', impact: '큼', implemented: true, fixed: null }
    expect(() => parseBugfixConfig({ fixAll: true, entries: [entry, entry] })).toThrow(/겹친다/)
    expect(() => parseBugfixConfig({ fixAll: true, entries: [{ ...entry, id: 'X-1' }] })).toThrow(/B-xx/)
    expect(() => parseBugfixConfig({ fixAll: true, entries: [{ ...entry, impact: '아주 큼' }] })).toThrow(/impact/)
    expect(() => parseBugfixConfig({ fixAll: true, entries: [{ ...entry, implemented: 1 }] })).toThrow(/implemented/)
    expect(() => parseBugfixConfig({ fixAll: true, entries: [{ ...entry, fixed: 1 }] })).toThrow(/fixed/)
  })
})

describe('isBugFixed', () => {
  const configOf = (fixAll: boolean, fixed: boolean | null, implemented = true): BugfixConfig => ({
    fixAll,
    entries: [{ id: 'B-09', name: '', symptom: '', source: '0xaeb08', impact: '중', implemented, fixed }],
  })

  it('시험은 원본(모두 끔)으로 돈다 — setupFiles', () => {
    for (const id of IMPLEMENTED_BUGFIX_IDS) expect(isBugFixed(id), id).toBe(false)
  })

  it('fixAll 참 + null 이면 고침, 거짓 + null 이면 원본', () => {
    setBugfixConfigForTests(configOf(true, null))
    expect(isBugFixed('B-09')).toBe(true)
    setBugfixConfigForTests(configOf(false, null))
    expect(isBugFixed('B-09')).toBe(false)
  })

  it('항목 fixed 가 fixAll 을 덮는다', () => {
    setBugfixConfigForTests(configOf(true, false))
    expect(isBugFixed('B-09')).toBe(false)
    setBugfixConfigForTests(configOf(false, true))
    expect(isBugFixed('B-09')).toBe(true)
  })

  it('고친 길이 없는(implemented 거짓) id 와 표에 없는 id 는 늘 원본이다', () => {
    setBugfixConfigForTests(configOf(true, true, false))
    expect(isBugFixed('B-09')).toBe(false)
    expect(isBugFixed('B-999')).toBe(false)
  })

  it('bugfixes.json 그대로면 고친 길이 있는 일곱 건이 켜지고 나머지는 원본이다', () => {
    setBugfixConfigForTests(null)
    for (const id of ORIGINAL_BUG_IDS) expect(isBugFixed(id), id).toBe(IMPLEMENTED_BUGFIX_IDS.includes(id))
  })

  it('bugfixConfigWith 는 고른 id 만 켠다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-14']))
    expect(isBugFixed('B-14')).toBe(true)
    expect(isBugFixed('B-01')).toBe(false)
  })
})
