// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { MissionResultBoard } from '@/pages/mission-play/ui/MissionResultBoard'

afterEach(cleanup)

describe('미션 결과 판 (0x4a384 모드 5·6 · 키 0x407f0)', () => {
  it('성공 — YOU WIN(result 0) · 획득/보유 G · 재도전 글 · 커서 기본 예', () => {
    render(<MissionResultBoard isSuccess earnedGamePoint={500} heldGamePoint={1_500} onExit={vi.fn()} />)
    expect(screen.getByTestId('미션-결과-그림').dataset.frame).toBe('0')
    expect(screen.getByAltText('RESULT')).toBeTruthy()
    expect(screen.getByTestId('미션-획득-G').dataset.value).toBe('500')
    expect(screen.getByTestId('미션-보유-G').dataset.value).toBe('1500')
    expect(screen.getByTestId('미션-재도전-글').textContent).toBe('재도전하시겠습니까?')
    expect(screen.getByTestId('미션-재도전-커서').dataset.answer).toBe('예')
  })

  it('실패 — YOU LOSE(result 1), 키로 커서를 옮겨 OK 하면 목록 · CLR 도 목록', () => {
    const onExit = vi.fn()
    render(<MissionResultBoard isSuccess={false} earnedGamePoint={0} onExit={onExit} />)
    expect(screen.getByTestId('미션-결과-그림').dataset.frame).toBe('1')
    fireEvent.keyDown(window, { key: '6' })
    expect(screen.getByTestId('미션-재도전-커서').dataset.answer).toBe('아니오')
    fireEvent.keyDown(window, { key: '5' })
    expect(onExit).toHaveBeenCalledWith('목록')
  })

  it('예 그대로 OK 면 다시', () => {
    const onExit = vi.fn()
    render(<MissionResultBoard isSuccess earnedGamePoint={0} onExit={onExit} />)
    fireEvent.keyDown(window, { key: 'Enter' })
    expect(onExit).toHaveBeenCalledWith('다시')
  })

  it('마선수 대결 — 창 없이 앞부분만, CLR 은 대결 끝', () => {
    const onExit = vi.fn()
    render(<MissionResultBoard isSuccess earnedGamePoint={0} aceMatch={{ flag11f: true, flag176: false }} onExit={onExit} />)
    expect(screen.queryByAltText('RESULT')).toBeNull()
    expect(screen.getByTestId('미션-결과-그림')).toBeTruthy()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onExit).toHaveBeenCalledWith('대결끝')
  })
})
