// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SeasonTeamSelectScreen, hiddenTeamHintOf } from '@/pages/season/ui/SeasonTeamSelectScreen'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { TEAMS } from '@/shared/config/original/teams'

/** 시즌 팀 고르기 0xca — 키 0x8da4 (8e06 칸 ≤ 9 → 0xc8 · 8e18~8ec2 히든 힌트 · 8ec8 취소) */

afterEach(cleanup)

const 알림글 = () => screen.getByRole('dialog', { name: '알림' }).textContent ?? ''

describe('시즌 팀 고르기 0xca', () => {
  it('칸 0~9 를 고르면 그 팀으로 넘긴다', () => {
    const onPick = vi.fn()
    render(<SeasonTeamSelectScreen onPick={onPick} onExit={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: TEAMS[9].name }))

    expect(onPick).toHaveBeenCalledWith(9)
  })

  it('잠긴 히든 칸은 힌트 [225] + [226+열] + [0] + [1] 팝업만 띄운다', () => {
    const onPick = vi.fn()
    render(<SeasonTeamSelectScreen onPick={onPick} onExit={vi.fn()} />)

    fireEvent.click(screen.getAllByRole('button', { name: '???' })[2])

    expect(알림글()).toContain('히든 팀 오픈 힌트')
    expect(알림글()).toContain('아마최강을 넘어서라')
    expect(알림글()).toContain('선택 할 수 없는 팀입니다')
    expect(알림글()).toContain('일반모드에서')
    expect(onPick).not.toHaveBeenCalled()
  })

  it('열린 히든 팀도 시즌에서는 못 고른다 — 그림은 서고 힌트에서 [0] 만 빠진다', () => {
    const onPick = vi.fn()
    render(<SeasonTeamSelectScreen openedHiddenIds={[10]} onPick={onPick} onExit={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: TEAMS[10].name }))

    expect(알림글()).toContain('당신은 국가대표')
    expect(알림글()).not.toContain('선택 할 수 없는 팀입니다')
    expect(onPick).not.toHaveBeenCalled()
  })

  it('힌트 글 서식 — 열림 "%s!N%s!N!N%s" · 잠김 "%s!N%s!N!N%s!N%s" (0xcc1ec · 0xcc1fc)', () => {
    expect(hiddenTeamHintOf(14, [14])).toBe(`${ORIGINAL_MODE_TEXT[225]}!N${ORIGINAL_MODE_TEXT[230]}!N!N${ORIGINAL_MODE_TEXT[1]}`)
    expect(hiddenTeamHintOf(11, [])).toBe(
      `${ORIGINAL_MODE_TEXT[225]}!N${ORIGINAL_MODE_TEXT[227]}!N!N${ORIGINAL_MODE_TEXT[0]}!N${ORIGINAL_MODE_TEXT[1]}`)
  })

  it('취소(−16)는 메인 메뉴로 나간다', () => {
    const onExit = vi.fn()
    render(<SeasonTeamSelectScreen onPick={vi.fn()} onExit={onExit} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onExit).toHaveBeenCalled()
  })
})
