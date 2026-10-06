// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NariMatchInfoScreen } from '@/pages/management/ui/NariMatchInfoScreen'
import { batterMatchInfoOf } from '@/pages/management/lib/nariMatchPrepare'
import { createCareer } from '@/entities/career/model/playerCareer'

/** 나리 142 경기 준비 — 키 0x13c30 · 그림 0x15d98 (직접 떴다) */

afterEach(cleanup)

const 띄우기 = () => {
  const match = batterMatchInfoOf(createCareer('준비'), { myBatter: 0, myPitcher: 0, opponentPitcher: 1, opponentBatter: 1 })
  const onStart = vi.fn()
  const onCancel = vi.fn()
  render(
    <NariMatchInfoScreen lines={match.lines} myTeamId={match.myTeamId} opponentTeamId={match.opponentTeamId}
      playerSide={match.playerSide} edition="타자편" gamePoint={0} onStart={onStart} onCancel={onCancel} />,
  )
  return { onStart, onCancel }
}

describe('142 경기 준비', () => {
  it('경기정보 다섯 줄을 두 벌 적는다', () => {
    띄우기()
    expect(screen.getByTestId('나리경기정보-승패-유저').textContent).toBe('0승0패')
    expect(screen.getByTestId('나리경기정보-마투수-CPU').textContent).not.toBe('-')
  })

  it('OK · 5 → 144 (0x13cb6)', () => {
    const { onStart } = 띄우기()
    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.keyDown(window, { key: '5' })
    expect(onStart).toHaveBeenCalledTimes(2)
  })

  it('CLR → 취소 (0x13c72) · 바닥 5 되돌아가기도 같다', () => {
    const { onCancel } = 띄우기()
    fireEvent.keyDown(window, { key: 'Escape' })
    fireEvent.click(screen.getByRole('button', { name: '되돌아가기' }))
    expect(onCancel).toHaveBeenCalledTimes(2)
  })

  it("'0' 경기진행 설정 갈래가 없다 — 시즌 0xdd 와 다르다", () => {
    const { onStart, onCancel } = 띄우기()
    fireEvent.keyDown(window, { key: '0' })
    expect(onStart).not.toHaveBeenCalled()
    expect(onCancel).not.toHaveBeenCalled()
  })
})
