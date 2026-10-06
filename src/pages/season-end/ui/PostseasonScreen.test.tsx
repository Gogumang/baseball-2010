// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { PostseasonScreen, postseasonPopupTextOf } from '@/pages/season-end/ui/PostseasonScreen'
import { startPostseason } from '@/entities/league/model/league'
import { TEAMS } from '@/shared/config/original/teams'

afterEach(cleanup)

describe('나만의리그 포스트시즌 대진 화면 (상태 128)', () => {
  it('팝업 글은 StrMODE 원문 — 우승 팀 발표 [137] 은 %s 에 팀 이름을 넣는다', () => {
    expect(postseasonPopupTextOf({ kind: '정규시즌우승' })).toContain('정규시즌 우승')
    expect(postseasonPopupTextOf({ kind: '한국시리즈우승' })).toContain('인기도 +15 / 평판 +25')
    const 발표 = postseasonPopupTextOf({ kind: '우승발표', champion: 3 })
    expect(발표).toContain(TEAMS[3].name)
    expect(발표).not.toContain('%s')
  })

  it('팝업이 없을 때만 [다음] 이 키(확인)다', () => {
    const onConfirm = vi.fn()
    const { rerender } = render(
      <PostseasonScreen edition="타자편" gamePoint={0} series={startPostseason([0, 1, 2, 3])} popup={null} onConfirm={onConfirm} onClosePopup={() => {}} />,
    )
    fireEvent.click(screen.getByText('다음'))
    expect(onConfirm).toHaveBeenCalledTimes(1)

    rerender(
      <PostseasonScreen edition="타자편" gamePoint={0} series={startPostseason([0, 1, 2, 3])} popup={{ kind: '정규시즌우승' }}
        onConfirm={onConfirm} onClosePopup={() => {}} />,
    )
    expect(screen.queryByText('다음')).toBeNull()
  })

  it('머리띠는 편 제목, 바닥은 1 — 되돌아가기가 없다 (0x16928 상태 0x80 → 0x853ac 끝 0x7f4ec)', () => {
    const { container } = render(
      <PostseasonScreen edition="투수편" gamePoint={0} series={startPostseason([0, 1, 2, 3])} popup={null}
        onConfirm={() => {}} onClosePopup={() => {}} />,
    )
    expect(container.querySelectorAll('img[data-footer-mark]')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: '되돌아가기' })).toBeNull()
    expect(container.querySelector('img[src*="game_frame/011"]')).not.toBeNull()
  })
})
