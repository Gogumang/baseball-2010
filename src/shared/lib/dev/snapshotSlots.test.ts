import { describe, expect, it } from 'vitest'
import { registerSnapshotSlot, snapshotSlots, trackCellForSnapshot, trackWeakCollectionForSnapshot } from '@/shared/lib/dev/snapshotSlots'

describe('경기 중간 스냅샷의 모듈 · 루프 칸 (r329)', () => {
  it('같은 이름 칸은 단 차례로 #0 · #1 — 뗀 칸은 빠지고 차례가 당겨진다', () => {
    const releaseA = registerSnapshotSlot('시험루프', { capture: () => 'a', restore: () => {} })
    const releaseB = registerSnapshotSlot('시험루프', { capture: () => 'b', restore: () => {} })
    expect(snapshotSlots().get('시험루프#0')?.capture()).toBe('a')
    expect(snapshotSlots().get('시험루프#1')?.capture()).toBe('b')
    releaseA()
    expect(snapshotSlots().get('시험루프#0')?.capture()).toBe('b')
    expect(snapshotSlots().has('시험루프#1')).toBe(false)
    releaseB()
  })

  it('약한 표 — 넣은 열쇠를 적고, 되살리면 새 표에도 같은 짝이 선다', () => {
    const counts = new WeakMap<object, number>()
    trackWeakCollectionForSnapshot('시험.counts', counts)
    const wait = { id: 1 }
    counts.set(wait, 3)
    counts.set(wait, 4)
    const slot = snapshotSlots().get('시험.counts#0')!
    expect(slot.weak).toBe('map')
    expect(slot.capture()).toEqual([[wait, 4]])

    const fresh = new WeakSet<object>()
    trackWeakCollectionForSnapshot('시험.fresh', fresh)
    fresh.add(wait)
    const setSlot = snapshotSlots().get('시험.fresh#0')!
    expect(setSlot.capture()).toEqual([wait])
    const restoredKey = { id: 2 }
    setSlot.restore([restoredKey], 0)
    expect(fresh.has(restoredKey)).toBe(true)
  })

  it('값 칸 객체 — 떠 둔 값을 같은 객체에 덮는다', () => {
    const cell = { value: 7 }
    trackCellForSnapshot('시험.cell', cell)
    const slot = snapshotSlots().get('시험.cell#0')!
    const saved = slot.capture()
    cell.value = 99
    slot.restore(saved, 0)
    expect(cell).toEqual({ value: 7 })
  })
})
