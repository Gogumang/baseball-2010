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
  it('칸 0~9 를 고르면 이름 입력 0xc8 로 — [2] 에 예 하면 그 팀과 이름으로 넘긴다 (0x4a58 → 0xcc)', () => {
    const onChoose = vi.fn()
    render(<SeasonTeamSelectScreen onChoose={onChoose} onExit={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: TEAMS[9].name }))
    expect(onChoose).not.toHaveBeenCalled()
    expect(document.body.textContent).toContain('한글 4글자, 영문 8글자')

    fireEvent.change(screen.getByLabelText('이름'), { target: { value: '단장님' } })
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(알림글()).toContain('이대로 결정 하시겠습니까?')
    fireEvent.click(screen.getByRole('button', { name: '예' }))

    expect(onChoose).toHaveBeenCalledWith(9, '단장님')
  })

  it('잠긴 히든 칸은 힌트 [225] + [226+열] + [0] + [1] 팝업만 띄운다', () => {
    const onChoose = vi.fn()
    render(<SeasonTeamSelectScreen onChoose={onChoose} onExit={vi.fn()} />)

    fireEvent.click(screen.getAllByRole('button', { name: '???' })[2])

    expect(알림글()).toContain('히든 팀 오픈 힌트')
    expect(알림글()).toContain('아마최강을 넘어서라')
    expect(알림글()).toContain('선택 할 수 없는 팀입니다')
    expect(알림글()).toContain('일반모드에서')
    expect(onChoose).not.toHaveBeenCalled()
  })

  it('열린 히든 팀도 시즌에서는 못 고른다 — 그림은 서고 힌트에서 [0] 만 빠진다', () => {
    const onChoose = vi.fn()
    render(<SeasonTeamSelectScreen openedHiddenIds={[10]} onChoose={onChoose} onExit={vi.fn()} />)

    fireEvent.click(screen.getByRole('button', { name: TEAMS[10].name }))

    expect(알림글()).toContain('당신은 국가대표')
    expect(알림글()).not.toContain('선택 할 수 없는 팀입니다')
    expect(onChoose).not.toHaveBeenCalled()
  })

  it('힌트 글 서식 — 열림 "%s!N%s!N!N%s" · 잠김 "%s!N%s!N!N%s!N%s" (0xcc1ec · 0xcc1fc)', () => {
    expect(hiddenTeamHintOf(14, [14])).toBe(`${ORIGINAL_MODE_TEXT[225]}!N${ORIGINAL_MODE_TEXT[230]}!N!N${ORIGINAL_MODE_TEXT[1]}`)
    expect(hiddenTeamHintOf(11, [])).toBe(
      `${ORIGINAL_MODE_TEXT[225]}!N${ORIGINAL_MODE_TEXT[227]}!N!N${ORIGINAL_MODE_TEXT[0]}!N${ORIGINAL_MODE_TEXT[1]}`)
  })

  it('취소(−16)는 메인 메뉴로 나간다', () => {
    const onExit = vi.fn()
    render(<SeasonTeamSelectScreen onChoose={vi.fn()} onExit={onExit} />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(onExit).toHaveBeenCalled()
  })
})

describe('이름 입력 0xc8 (키 0xbc44)', () => {
  const 이름칸 = () => screen.getByLabelText('이름') as HTMLInputElement
  const 이름까지 = (onChoose = vi.fn()) => {
    render(<SeasonTeamSelectScreen onChoose={onChoose} onExit={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: TEAMS[0].name }))
    return onChoose
  }

  it('이름이 비었으면 확인은 아무것도 안 한다 — [2] 팝업이 안 뜬다', () => {
    이름까지()
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('취소는 이름이 있으면 한 글자 지우고, 비었으면 팀 고르기 0xca 로', () => {
    이름까지()
    fireEvent.change(이름칸(), { target: { value: '가나' } })
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(이름칸().value).toBe('가')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(이름칸().value).toBe('')
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByLabelText('이름')).toBeNull()
    expect(screen.getByRole('button', { name: TEAMS[0].name })).toBeDefined()
  })

  it('최대 8바이트 — 한글 넷까지 받고 다섯째는 안 받는다 (입력기 +8 = 8)', () => {
    이름까지()
    fireEvent.change(이름칸(), { target: { value: '가나다라' } })
    fireEvent.change(이름칸(), { target: { value: '가나다라마' } })
    expect(이름칸().value).toBe('가나다라')
  })

  it('[2] 에 아니오면 0xc8 에 남는다', () => {
    const onChoose = 이름까지()
    fireEvent.change(이름칸(), { target: { value: 'ABC' } })
    fireEvent.keyDown(window, { key: 'Enter' })
    fireEvent.click(screen.getByRole('button', { name: '아니오' }))
    expect(onChoose).not.toHaveBeenCalled()
    expect(이름칸().value).toBe('ABC')
  })
})
