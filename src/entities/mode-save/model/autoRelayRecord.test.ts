import { describe, expect, it } from 'vitest'
import {
  autoRelayModeSlotOf,
  createAutoRelayRecordPort,
  NEW_AUTO_RELAY_RECORD,
  normalizeAutoRelayRecord,
  withAutoProgressStopped,
  withAutoRelaySpeed,
} from '@/entities/mode-save/model/autoRelayRecord'

describe('전역기록 자동진행 칸 — +0xbc 속도 · +0x14d + m 중단 표시', () => {
  it('새 저장(생성자 0x9f26c)은 속도 1 · 중단 표시 셋 다 0', () => {
    expect(NEW_AUTO_RELAY_RECORD).toEqual({ speed: 1, stopped: [false, false, false] })
    expect(normalizeAutoRelayRecord(null)).toEqual(NEW_AUTO_RELAY_RECORD)
    expect(normalizeAutoRelayRecord({ speed: 7, stopped: 'x' })).toEqual(NEW_AUTO_RELAY_RECORD)
    expect(normalizeAutoRelayRecord({ speed: 0, stopped: [false, true] })).toEqual({ speed: 0, stopped: [false, true, false] })
  })

  it('모드 칸 m — 0x3301c: 시즌 2 → 1 · 대전 8 · 9 → 2 · 그 밖 0', () => {
    expect([1, 2, 8, 9, 3].map(autoRelayModeSlotOf)).toEqual([0, 1, 2, 2, 0])
  })

  it('속도는 0..2 안에서만 바뀌고, 중단 표시는 그 모드 칸만 쓴다', () => {
    expect(withAutoRelaySpeed(NEW_AUTO_RELAY_RECORD, 5).speed).toBe(2)
    expect(withAutoRelaySpeed(NEW_AUTO_RELAY_RECORD, -1).speed).toBe(0)
    expect(withAutoRelaySpeed(NEW_AUTO_RELAY_RECORD, 1)).toBe(NEW_AUTO_RELAY_RECORD)
    expect(withAutoProgressStopped(NEW_AUTO_RELAY_RECORD, 1, true).stopped).toEqual([false, true, false])
  })

  it('손잡이는 고칠 때마다 곧바로 저장소에 쓴다 (0x1f1b8) — 다시 열어도 남는다', () => {
    let saved: unknown = null
    const store = { load: () => saved, save: (value: object) => { saved = value } }
    const port = createAutoRelayRecordPort(store)
    port.setSpeed(0)
    port.setStopped(2, true)
    expect(createAutoRelayRecordPort(store).read()).toEqual({ speed: 0, stopped: [false, false, true] })
  })
})
