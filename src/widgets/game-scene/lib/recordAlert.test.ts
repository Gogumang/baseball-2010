import { describe, expect, it } from 'vitest'
import {
  EMPTY_RECORD_ALERT, RECORD_ALERT_LIFETIME, accrueRecordGamePoint, drawRecordAlert, enqueueRecordAlert,
  fillRecordAlertSlots, flushRecordAlertQueue, isGameEndRecord, leadingRecordCountOf,
} from '@/widgets/game-scene/lib/recordAlert'
import { RECORD_NAMES, recordGamePointsOf } from '@/entities/game/model/gameRecords'

describe('경기 중 기록 달성 알림 0x4e35c · 0x4e600', () => {
  it('칸에 넣으면 폭 1 · 시간 0, 그릴 때마다 폭 ×2 (100 상한) — 판 x = W − 폭[0]', () => {
    let state = fillRecordAlertSlots(accrueRecordGamePoint(EMPTY_RECORD_ALERT, [1]), [1])
    const widths: number[] = []
    for (let i = 0; i < 8; i += 1) {
      const drawn = drawRecordAlert(state, i, false)
      state = drawn.next
      widths.push(240 - drawn.frame.panel!.x)
    }
    expect(widths).toEqual([2, 4, 8, 16, 32, 64, 100, 100])
  })

  it('판 (x, 5, 100, 15·(n+1)+9) · 머리 (x+3, 9) · 줄 (W − 폭 + 3, 27 + 15·칸) · G (x + 0x32, 9) 는 누계', () => {
    let state = accrueRecordGamePoint(EMPTY_RECORD_ALERT, [1, 15])
    state = fillRecordAlertSlots(state, [1, 15])
    const { frame } = drawRecordAlert(state, 0, false)
    expect(frame.panel).toMatchObject({ x: 238, y: 5, width: 100, height: 15 * 3 + 9, title: { x: 241, y: 9 } })
    expect(frame.panel!.gamePoint).toEqual({ value: recordGamePointsOf([1, 15]), x: 238 + 0x32, y: 9 })
    expect(frame.rows.map((row) => [row.slot, row.text, row.x, row.y])).toEqual([
      [0, RECORD_NAMES[1], 241, 27],
      [1, RECORD_NAMES[15], 241, 42],
    ])
  })

  it('노랑 줄은 (틱 % 18) / 6 == 칸 번호', () => {
    const state = fillRecordAlertSlots(EMPTY_RECORD_ALERT, [1, 2])
    expect(drawRecordAlert(state, 6, false).frame.rows.map((row) => row.isHighlighted)).toEqual([false, true])
    expect(drawRecordAlert(state, 17, false).frame.rows.map((row) => row.isHighlighted)).toEqual([false, false])
  })

  it('시간 > 50 이면 칸을 내리고 누계 0 — 그 프레임은 판 높이에 세지만 줄 · G 는 안 그린다', () => {
    let state = accrueRecordGamePoint(EMPTY_RECORD_ALERT, [1])
    state = fillRecordAlertSlots(state, [1])
    let drawn = drawRecordAlert(state, 0, false)
    for (let i = 1; i < RECORD_ALERT_LIFETIME; i += 1) drawn = drawRecordAlert(drawn.next, i, false)
    expect(drawn.frame.rows).toHaveLength(1)
    drawn = drawRecordAlert(drawn.next, 51, false)
    expect(drawn.frame.panel).not.toBeNull()
    expect(drawn.frame.rows).toHaveLength(0)
    expect(drawn.frame.panel!.gamePoint).toBeNull()
    expect(drawn.next.pendingGamePoint).toBe(0)
    expect(drawRecordAlert(drawn.next, 52, false).frame.panel).toBeNull()
  })

  it('빈 칸이 없으면 버린다 · 칸 0 이 비어도 판 x 는 칸 0 의 남은 폭', () => {
    const full = fillRecordAlertSlots(EMPTY_RECORD_ALERT, [0, 1, 2, 3, 4, 5])
    expect(full.slots).toEqual([0, 1, 2, 3, 4])
    const stale = { ...EMPTY_RECORD_ALERT, widths: [100, 0, 0, 0, 0], slots: [null, 3, null, null, null] }
    const { frame } = drawRecordAlert(stale, 0, true)
    expect(frame.panel!.x).toBe(140)
    expect(frame.rows[0]).toMatchObject({ slot: 1, x: 243, y: 42 })
  })

  it('0xa77f0 은 누계에 더하고 줄에 넣기만 — 0x4e600 이 줄을 칸으로 옮기고 비운다', () => {
    const queued = enqueueRecordAlert(EMPTY_RECORD_ALERT, [1, 15])
    expect(queued.slots).toEqual(EMPTY_RECORD_ALERT.slots)
    expect(queued.queue).toEqual([1, 15])
    expect(queued.pendingGamePoint).toBe(recordGamePointsOf([1, 15]))
    const flushed = flushRecordAlertQueue(queued, {})
    expect(flushed.slots.slice(0, 2)).toEqual([1, 15])
    expect(flushed.queue).toEqual([])
  })

  it('0x4e600 — 정산(0x19)이면 줄을 두고, 강판 뒤(시뮬 +0)면 줄을 버리고 누계 0', () => {
    const queued = enqueueRecordAlert(EMPTY_RECORD_ALERT, [16])
    expect(flushRecordAlertQueue(queued, { isSettled: true })).toBe(queued)
    const dropped = flushRecordAlertQueue(queued, { isPitcherRemoved: true, isSettled: true })
    expect(dropped.queue).toEqual([])
    expect(dropped.pendingGamePoint).toBe(0)
    expect(dropped.slots).toEqual(EMPTY_RECORD_ALERT.slots)
  })

  it('경기 끝 기록은 28~31 · 37~39 (0xa7818 마스크 0xe0f) — 앞쪽 몫 세기', () => {
    expect([27, 28, 31, 32, 36, 37, 39].map(isGameEndRecord)).toEqual([false, true, true, false, false, true, true])
    expect(leadingRecordCountOf([16, 17, 1, 16], (id) => id >= 16)).toBe(2)
    expect(leadingRecordCountOf([16], (id) => id >= 16)).toBe(1)
  })
})
