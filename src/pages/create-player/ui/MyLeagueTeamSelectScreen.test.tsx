// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MyLeagueTeamSelectScreen } from '@/pages/create-player/ui/MyLeagueTeamSelectScreen'
import { TEAMS } from '@/shared/config/original/teams'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { hiddenTeamHintMessage } from '@/pages/general-mode/lib/hiddenTeam'

vi.mock('@/widgets/screen-frame/model/useListPageEntry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/widgets/screen-frame/model/useListPageEntry')>()
  return { ...actual, useListPageEntry: actual.settledListPageEntry }
})

afterEach(cleanup)

describe('나리 101 팀 고르기 — 히든 줄 0x14114', () => {
  it('열린 히든 팀도 등록으로 안 가고 [225]!N[226+k]!N!N[1] 팝업을 띄운다 (0xcc1ec)', () => {
    const onSelect = vi.fn()
    render(<MyLeagueTeamSelectScreen side="타자편" title="나만의리그타자편" openedHiddenIds={[10]} onSelect={onSelect} onCancel={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: TEAMS[10].name }))

    expect(onSelect).not.toHaveBeenCalled()
    expect(hiddenTeamHintMessage(10, { openedHiddenIds: [10], mode: 4 }))
      .toBe(`${ORIGINAL_MODE_TEXT[225]}!N${ORIGINAL_MODE_TEXT[226]}!N!N${ORIGINAL_MODE_TEXT[1]}`)
    expect(screen.getByRole('dialog')).toBeTruthy()
  })

  it('잠긴 히든 팀은 [225]!N[226+k]!N!N[0]!N[1] (0xcc1fc)', () => {
    expect(hiddenTeamHintMessage(14, { openedHiddenIds: [], mode: 3 }))
      .toBe(`${ORIGINAL_MODE_TEXT[225]}!N${ORIGINAL_MODE_TEXT[230]}!N!N${ORIGINAL_MODE_TEXT[0]}!N${ORIGINAL_MODE_TEXT[1]}`)
  })

  it('기본 팀은 그대로 등록으로 넘긴다 — 키 5', () => {
    const onSelect = vi.fn()
    render(<MyLeagueTeamSelectScreen side="투수편" title="나만의리그투수편" openedHiddenIds={[10, 11]} onSelect={onSelect} onCancel={vi.fn()} />)

    fireEvent.keyDown(window, { key: '5' })

    expect(onSelect).toHaveBeenCalledWith(0)
  })
})
