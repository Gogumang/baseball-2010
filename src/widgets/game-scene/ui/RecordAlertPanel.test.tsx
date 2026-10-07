// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { RecordAlertPanel } from '@/widgets/game-scene/ui/RecordAlertPanel'
import { EMPTY_RECORD_ALERT, accrueRecordGamePoint, drawRecordAlert, fillRecordAlertSlots } from '@/widgets/game-scene/lib/recordAlert'

afterEach(cleanup)

describe('경기 중 기록 달성 알림 판 0x4e35c', () => {
  it('줄 글(StrGAME[k + 8]) 과 G 누계를 그린다 · 빈 판이면 아무것도 없다', () => {
    const state = fillRecordAlertSlots(accrueRecordGamePoint(EMPTY_RECORD_ALERT, [4]), [4])
    render(<RecordAlertPanel frame={drawRecordAlert(state, 0, false).frame} />)
    expect(screen.getByTestId('기록달성-줄-0').textContent).toBe('만루 홈런')
    expect(screen.getByTestId('기록달성-G').dataset.value).toBe('15')
    cleanup()
    render(<RecordAlertPanel frame={{ panel: null, rows: [] }} />)
    expect(screen.queryByTestId('기록달성-알림')).toBeNull()
  })
})
