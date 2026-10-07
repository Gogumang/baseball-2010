// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SeasonPlayerPickScreen } from '@/pages/season/ui/SeasonPlayerPickScreen'
import { tableRosterOf } from '@/entities/season-mode/model/seasonEntry'
import { ENTRY_TAB } from '@/entities/season-mode/model/entryEditor'
import { PLAYER_PICK_PURPOSE, playerPickCancelTarget, refusesEquipment } from '@/entities/season-mode/model/playerPick'
import { SEASON_SCENE_STATE } from '@/entities/season-mode/model/seasonStateMachine'

/**
 * 공용 선수 고르기 0xdf (목적 1·2) — 엔트리 편집과 같은 목록 창을 보기 전용으로 쓰고, 확인·취소만 키 0xc3e8 이 받는다.
 */

afterEach(cleanup)

const 키 = (key: string) => fireEvent.keyDown(window, { key })

describe('선수 고르기 0xdf', () => {
  it('공통 앞그림 0xb810 — 0xdf 는 0xdd · 0xe0 · 0xe1 밖이라 공 무늬를 먼저 깐다', () => {
    render(<SeasonPlayerPickScreen teamId={0} roster={tableRosterOf(0)} initialTab={ENTRY_TAB.투수} onPick={vi.fn()} onBack={vi.fn()} />)
    expect(screen.getByTestId('바탕-공무늬')).toBeTruthy()
  })

  it('보기 전용 — 확인은 줄을 고르지 않고 고른 탭·커서를 넘긴다', () => {
    const onPick = vi.fn()
    render(<SeasonPlayerPickScreen teamId={0} roster={tableRosterOf(0)} initialTab={ENTRY_TAB.투수} onPick={onPick} onBack={vi.fn()} />)

    키('ArrowDown')
    키('ArrowDown')
    키('Enter')

    expect(onPick).toHaveBeenCalledWith(ENTRY_TAB.투수, 2)
  })

  it("'*' 는 탭을 뒤집고 커서를 0 으로 (0x55864) — 바닥은 탭대로 0xf / 0x17", () => {
    const onPick = vi.fn()
    render(<SeasonPlayerPickScreen teamId={0} roster={tableRosterOf(0)} initialTab={ENTRY_TAB.투수} onPick={onPick} onBack={vi.fn()} />)

    키('ArrowDown')
    키('*')
    expect(screen.getByTestId('엔트리-줄-0').textContent).toContain('박택용')
    키('Enter')

    expect(onPick).toHaveBeenCalledWith(ENTRY_TAB.타자, 0)
  })

  it('취소는 부르는 쪽으로 — 목적 1 → 0xd0 · 2 → 0xcd · 3 → 0xe2', () => {
    const onBack = vi.fn()
    render(<SeasonPlayerPickScreen teamId={0} roster={tableRosterOf(0)} initialTab={ENTRY_TAB.타자} onPick={vi.fn()} onBack={onBack} />)
    키('Escape')
    expect(onBack).toHaveBeenCalled()

    expect(playerPickCancelTarget(PLAYER_PICK_PURPOSE.장착아이템)).toBe(SEASON_SCENE_STATE.아이템)
    expect(playerPickCancelTarget(PLAYER_PICK_PURPOSE.선수정보)).toBe(SEASON_SCENE_STATE.시즌정보)
    expect(playerPickCancelTarget(PLAYER_PICK_PURPOSE.선수영입)).toBe(SEASON_SCENE_STATE.선수영입)
  })

  it('목적 1 거절 0xb6388 — +0xa 비트 7(나리 선수)만, 명예 선수(+0xa 0 / 0x20)는 통과', () => {
    expect(refusesEquipment({ id: 0xfe, kindByte: 0x80, fieldPosition: 0, stamina: 0 })).toBe(true)
    expect(refusesEquipment({ id: 0xfe, kindByte: 0xa3, fieldPosition: 0, stamina: 0 })).toBe(true)
    expect(refusesEquipment({ id: 0xc8, kindByte: 0x20, fieldPosition: 0, stamina: 0 })).toBe(false)
    expect(refusesEquipment({ id: 3, kindByte: 3, fieldPosition: 0, stamina: 0 })).toBe(false)
  })
})
