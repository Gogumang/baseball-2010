// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { SeasonChainFrameScreen } from '@/pages/season/ui/SeasonChainFrameScreen'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'

afterEach(cleanup)

describe('시즌 끝 사슬 상태의 그림 0x9fe4 → 공통 틀 0x9f60', () => {
  it('공 무늬 · 상태판 · 머리띠를 그린다 — 근사 목록 창이 아니다', () => {
    const { container } = render(<SeasonChainFrameScreen state={startNewSeason(0, '테스터')} gamePoint={0} cursor={0} />)
    expect(screen.getByTestId('바탕-공무늬')).toBeTruthy()
    expect(container.querySelector('[data-testid="command-bar"]')).toBeTruthy()
  })

  it('커맨드 줄은 칸이 없다 — 0x7e84c 가 0xeb · 0xec · 0xed · 0xee · 0xf0 에서 칸 수를 0 으로 둔다 (7e862~7e86e · 7e952)', () => {
    render(<SeasonChainFrameScreen state={startNewSeason(0, '테스터')} gamePoint={0} cursor={2} />)
    expect(screen.queryAllByRole('button', { name: /시즌정보|구단관리|트레이닝|외출|아이템|다음경기/ })).toHaveLength(0)
  })
})
