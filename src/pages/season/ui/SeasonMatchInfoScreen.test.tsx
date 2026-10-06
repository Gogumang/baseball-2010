// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import { SeasonMatchInfoScreen } from '@/pages/season/ui/SeasonMatchInfoScreen'
import { PLAYER_SIDE_LAST_BAT } from '@/entities/game/model/gameState'

/** 시즌 경기정보 0xdd — 키 0x83cc 의 좌·우 */

afterEach(cleanup)

describe('시즌 경기정보 0xdd', () => {
  it("'4'/왼은 유저 팀, '6'/오른은 CPU 팀 엔트리 편집 0xe0 으로 (this+0x120 = 1 / 0)", () => {
    const onOpenEntry = vi.fn()
    render(
      <SeasonMatchInfoScreen lines={[]} myTeamId={0} opponentTeamId={1} playerSide={PLAYER_SIDE_LAST_BAT}
        onStart={vi.fn()} onOpenSettings={vi.fn()} onCancel={vi.fn()} onOpenEntry={onOpenEntry} />,
    )
    for (const key of ['4', 'ArrowLeft', '6', 'ArrowRight']) fireEvent.keyDown(window, { key })
    expect(onOpenEntry.mock.calls).toEqual([[true], [true], [false], [false]])
  })

  it('바닥은 0x44 — "0경기설정"(game_frame 프레임 6) + 되돌아가기 (0xb3cc~0xb3e2)', () => {
    const { container } = render(
      <SeasonMatchInfoScreen lines={[]} myTeamId={0} opponentTeamId={1} playerSide={PLAYER_SIDE_LAST_BAT}
        onStart={vi.fn()} onOpenSettings={vi.fn()} onCancel={vi.fn()} />,
    )
    // 경기설정 표시는 18틱 중 9틱만 보여 첫 틱에 있다
    expect([...container.querySelectorAll('img[data-footer-mark]')].map((node) => (node as HTMLElement).dataset.footerMark)).toEqual(['6'])
    expect(container.querySelector('button[aria-label="되돌아가기"]')).toBeTruthy()
  })
})
