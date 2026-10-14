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

  it("OK·'5' 는 경기 시작 0x847e (0x8442 cmp r4, #0x35)", () => {
    const onStart = vi.fn()
    render(
      <SeasonMatchInfoScreen lines={[]} myTeamId={0} opponentTeamId={1} playerSide={PLAYER_SIDE_LAST_BAT}
        onStart={onStart} onOpenSettings={vi.fn()} onCancel={vi.fn()} />,
    )
    for (const key of ['Enter', '5']) fireEvent.keyDown(window, { key })
    expect(onStart).toHaveBeenCalledTimes(2)
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

describe('0xdd 들어올 때 연출 (0xb398 의 0x63b15 넷째 인자 — 이전 ≠ 0xe0)', () => {
  it('켜져 있으면 첫 그림은 본문이 없다 — 0xe0 에서 돌아온 것(꺼짐)이면 곧바로 본문', () => {
    const lines = [{ label: '순위', labelFrame: 0, user: '1', cpu: '2' }]
    const props = {
      lines, myTeamId: 0, opponentTeamId: 1, playerSide: PLAYER_SIDE_LAST_BAT,
      onStart: vi.fn(), onOpenSettings: vi.fn(), onCancel: vi.fn(),
    }
    const first = render(<SeasonMatchInfoScreen {...props} isEntryAnimated />)
    expect(first.queryByTestId('시즌경기정보-순위-유저')).toBeNull()
    first.unmount()

    const second = render(<SeasonMatchInfoScreen {...props} isEntryAnimated={false} />)
    expect(second.getByTestId('시즌경기정보-순위-유저').textContent).toBe('1')
  })
})
