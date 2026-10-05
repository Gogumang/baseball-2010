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
})
