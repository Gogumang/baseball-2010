// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render } from '@testing-library/react'
import { createCareer } from '@/entities/career/model/playerCareer'
import { addSkinStepCounter, resetSkinStepCounter, skinStepCounterValue } from '@/shared/lib/skinStepCounter/skinStepCounter'
import { RECORD_ROOM_PICK } from '@/pages/nari-record-room/lib/nariRecordRoom'
import { NariRecordView } from '@/pages/nari-record-room/ui/NariRecordRoom'
import { SeasonRecordRankScreen } from '@/pages/season/ui/SeasonRecordRankScreen'

afterEach(cleanup)

const press = (key: string) =>
  act(() => {
    fireEvent.keyDown(window, { key })
  })

describe('순위 판 [판+0x40c] 키 셈 — 0x5761c · 0x1463c · 0x74c4 (r168 재대조)', () => {
  it("나리 124 순위: 진입은 0x5561c 를 안 지나 앞 값에서 잇고(0x116d4 첫 인자 0) · 취소 · '0' · '*' 도 0x5787d 로 +1", () => {
    resetSkinStepCounter()
    addSkinStepCounter(5)
    const onBack = vi.fn()
    render(<NariRecordView pick={RECORD_ROOM_PICK.순위기록} edition="타자" career={createCareer('선수')} gamePoint={0} onBack={onBack} />)
    expect(skinStepCounterValue()).toBe(5)
    press('0')
    press('*')
    press('ArrowRight')
    expect(skinStepCounterValue()).toBe(8)
    press('Escape')
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(skinStepCounterValue()).toBe(9)
  })

  it("나리 124 연도 기록: 진입이 0x5561c 로 0 · '0' · '*' 는 버리고 · 취소는 0x55864 머리에서 +1", () => {
    resetSkinStepCounter()
    addSkinStepCounter(5)
    const onBack = vi.fn()
    render(<NariRecordView pick={RECORD_ROOM_PICK.개인기록} edition="타자" career={createCareer('선수')} gamePoint={0} onBack={onBack} />)
    expect(skinStepCounterValue()).toBe(0)
    press('0')
    press('*')
    expect(skinStepCounterValue()).toBe(0)
    press('5')
    expect(skinStepCounterValue()).toBe(1)
    press('Escape')
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(skinStepCounterValue()).toBe(2)
  })

  it('시즌 0xdb: 진입은 리셋 없음(0x56fc 첫 인자 0) · 취소만 0xcd 로 빼고 셈 없음(0x74c4)', () => {
    resetSkinStepCounter()
    addSkinStepCounter(3)
    const onBack = vi.fn()
    render(<SeasonRecordRankScreen side="타자" page={0} entries={[]} myTeamId={0} onMovePage={() => undefined} onBack={onBack} />)
    expect(skinStepCounterValue()).toBe(3)
    press('0')
    press('*')
    expect(skinStepCounterValue()).toBe(5)
    press('Escape')
    expect(onBack).toHaveBeenCalledTimes(1)
    expect(skinStepCounterValue()).toBe(5)
  })
})
