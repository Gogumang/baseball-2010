import { afterEach, describe, expect, it, vi } from 'vitest'
import rawConfig from '@/shared/config/unlocks/unlocks.json'
import {
  ORIGINAL_UNLOCK_CONFIG,
  UNLOCK_CONFIG,
  aceCellUnlockIdOf,
  codeUnlockIds,
  hallOfFameSlotUnlockIdOf,
  hiddenTeamUnlockIdOf,
  hiddenUnlockIdOf,
  isUnlocked,
  missionUnlockIdOf,
  parseUnlockConfig,
  setUnlockConfigForTests,
} from '@/shared/config/unlocks'
import type { UnlockConfig, UnlockKind } from '@/shared/config/unlocks'

afterEach(() => setUnlockConfigForTests(ORIGINAL_UNLOCK_CONFIG))

describe('unlocks.json 모양', () => {
  it('TS 타입 검사를 통과하고 기본은 모두 풀림이다 (사용자 요청 2026-10-25)', () => {
    const config = parseUnlockConfig(rawConfig)
    expect(config.unlockAll).toBe(true)
    expect(config.entries.length).toBeGreaterThan(0)
    for (const entry of config.entries) {
      expect(entry.name, entry.id).not.toBe('')
      expect(entry.condition, entry.id).not.toBe('')
      expect(entry.source, entry.id).toMatch(/0x[0-9a-f]+/)
    }
  })

  it('항목 id 가 코드가 쓰는 id 와 1:1 이다', () => {
    const jsonIds = UNLOCK_CONFIG.entries.map((entry) => entry.id)
    const codeIds = codeUnlockIds()
    expect(new Set(codeIds).size).toBe(codeIds.length)
    expect([...jsonIds].sort()).toEqual([...codeIds].sort())
  })

  it('범주별 항목 수', () => {
    const counts = UNLOCK_CONFIG.entries.reduce<Partial<Record<UnlockKind, number>>>(
      (acc, entry) => ({ ...acc, [entry.kind]: (acc[entry.kind] ?? 0) + 1 }),
      {},
    )
    expect(counts).toEqual({
      acePlayer: 8,
      hiddenTeam: 5,
      stadiumItem: 6,
      pitcherEquipment: 16,
      batterEquipment: 16,
      hiddenPitch: 4,
      mission: 26,
      hallOfFameSlot: 6,
      annalsPage: 1,
    })
  })

  it('드래고나는 표의 한 항목이고 기본은 풀린다', () => {
    const dragona = UNLOCK_CONFIG.entries.find((entry) => entry.id === 'ace-dragona')
    expect(dragona).toMatchObject({ kind: 'acePlayer', name: '드래고나', unlocked: null })
    expect(aceCellUnlockIdOf(4)).toBe('ace-dragona')
  })

  it('틀린 모양은 막는다', () => {
    expect(() => parseUnlockConfig(null)).toThrow()
    expect(() => parseUnlockConfig({ unlockAll: 'yes', entries: [] })).toThrow(/unlockAll/)
    const entry = { id: 'a', kind: 'mission', name: 'n', condition: 'c', source: '0x1', unlocked: null }
    expect(() => parseUnlockConfig({ unlockAll: true, entries: [entry, entry] })).toThrow(/겹친다/)
    expect(() => parseUnlockConfig({ unlockAll: true, entries: [{ ...entry, kind: 'skill' }] })).toThrow(/kind/)
    expect(() => parseUnlockConfig({ unlockAll: true, entries: [{ ...entry, unlocked: 1 }] })).toThrow(/unlocked/)
  })
})

describe('isUnlocked', () => {
  const configOf = (unlockAll: boolean, unlocked: boolean | null): UnlockConfig => ({
    unlockAll,
    entries: [{ id: 'mission-batter-2', kind: 'mission', name: '', condition: '', source: '0x1db26', unlocked }],
  })

  it('unlockAll 참 + null 이면 원본 판정을 부르지 않고 풀린다', () => {
    setUnlockConfigForTests(configOf(true, null))
    const original = vi.fn(() => false)
    expect(isUnlocked('mission-batter-2', original)).toBe(true)
    expect(original).not.toHaveBeenCalled()
  })

  it('unlockAll 거짓 + null 이면 원본 판정 그대로', () => {
    setUnlockConfigForTests(configOf(false, null))
    expect(isUnlocked('mission-batter-2', () => false)).toBe(false)
    expect(isUnlocked('mission-batter-2', () => true)).toBe(true)
  })

  it('항목 true 는 unlockAll 거짓이어도 풀고, false 는 unlockAll 참이어도 원본 판정이다', () => {
    setUnlockConfigForTests(configOf(false, true))
    expect(isUnlocked('mission-batter-2', () => false)).toBe(true)
    setUnlockConfigForTests(configOf(true, false))
    expect(isUnlocked('mission-batter-2', () => false)).toBe(false)
    expect(isUnlocked('mission-batter-2', () => true)).toBe(true)
  })

  it('시험 준비 파일은 원본 잠금으로 돈다', () => {
    expect(isUnlocked('ace-dragona', () => false)).toBe(false)
    setUnlockConfigForTests(null)
    expect(isUnlocked('ace-dragona', () => false)).toBe(true)
  })
})

describe('id 만들기', () => {
  it('전역 해금 k 0~50', () => {
    expect(hiddenUnlockIdOf(0)).toBe('ace-leony')
    expect(hiddenUnlockIdOf(7)).toBe('ace-tiger')
    expect(hiddenUnlockIdOf(8)).toBe('hidden-team-korea')
    expect(hiddenUnlockIdOf(12)).toBe('hidden-team-outsiders')
    expect(hiddenUnlockIdOf(41)).toBe('hidden-item-41')
    expect(hiddenUnlockIdOf(51)).toBeNull()
    expect(hiddenUnlockIdOf(-1)).toBeNull()
  })

  it('기본 개방 칸은 표에 없다', () => {
    expect(aceCellUnlockIdOf(0)).toBeNull()
    expect(aceCellUnlockIdOf(5)).toBeNull()
    expect(aceCellUnlockIdOf(9)).toBe('ace-tiger')
    expect(hiddenTeamUnlockIdOf(9)).toBeNull()
    expect(hiddenTeamUnlockIdOf(14)).toBe('hidden-team-outsiders')
    expect(missionUnlockIdOf('타자', 0)).toBeNull()
    expect(missionUnlockIdOf('투수', 13)).toBe('mission-pitcher-14')
    expect(missionUnlockIdOf('투수', 14)).toBeNull()
    expect(hallOfFameSlotUnlockIdOf('투수', 1)).toBeNull()
    expect(hallOfFameSlotUnlockIdOf('투수', 2)).toBe('hall-of-fame-pitcher-slot-3')
    expect(hallOfFameSlotUnlockIdOf('타자', 3)).toBeNull()
    expect(hallOfFameSlotUnlockIdOf('타자', 7)).toBe('hall-of-fame-batter-slot-8')
    expect(hallOfFameSlotUnlockIdOf('타자', 8)).toBeNull()
  })
})
