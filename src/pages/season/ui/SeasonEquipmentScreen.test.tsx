// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SeasonEquipmentScreen } from '@/pages/season/ui/SeasonEquipmentScreen'
import { seasonPlayerRecordOf } from '@/entities/season-mode/model/seasonPlayerRecord'
import { tableRosterOf } from '@/entities/season-mode/model/seasonEntry'
import { startNewSeason } from '@/entities/season-mode/model/seasonRecord'

afterEach(cleanup)

const 키 = (key: string) => fireEvent.keyDown(window, { key })

function 띄우기(equipment: readonly number[] = [0, 0, 0, 0]) {
  const record = { ...startNewSeason(0, '테스터').record, money: 5000 }
  const view = { ...seasonPlayerRecordOf(0, tableRosterOf(0).batters[0]!, false, 0), equipment }
  const onBack = vi.fn()
  render(<SeasonEquipmentScreen record={record} teamMorale={100} view={view} equipment={equipment}
    isHiddenOpen={() => false} onPurchase={vi.fn()} onBack={onBack} />)
  return { onBack }
}

const 니블 = () => screen.getByTestId('장비-창').dataset.nibbles

describe('장비 창 0xdc 종류 3 (0x83378 · 0x819ac)', () => {
  it('부위 목록은 좌우로 감고, 아래·확인으로 칸 목록에 들어가며 첫 칸을 끼워 본다', () => {
    띄우기()
    키('ArrowLeft')
    expect(screen.getByRole('button', { name: '부위 4' }).getAttribute('aria-current')).toBe('true')
    키('ArrowRight')
    키('ArrowRight')
    expect(screen.getByRole('button', { name: '부위 2' }).getAttribute('aria-current')).toBe('true')
    expect(screen.queryByTestId('장비-가격')).toBeNull()
    키('ArrowDown')
    expect(니블()).toBe('0,1,0,0')
    expect(screen.getByTestId('장비-가격').getAttribute('aria-label')).toBe('5000')
    expect(screen.getByTestId('장비-효과').getAttribute('aria-label')).toBe('+30')
    expect(screen.getByTestId('장비-설명').getAttribute('aria-label')).toBe('인기도 제한 없음')
  })

  it('칸을 옮기면 끼워 보고(감는다 · 다섯 줄 굴림), 취소하면 진짜 니블로 되돌린다', () => {
    띄우기([0, 3, 0, 0])
    키('ArrowRight')
    키('Enter')
    키('ArrowUp') // 0 → 10 (감는다)
    expect(니블()).toBe('0,11,0,0')
    expect(screen.getByTestId('장비-칸-10').textContent).toBe('????')
    expect(screen.queryByTestId('장비-칸-0')).toBeNull()
    expect(screen.getByTestId('장비-설명').getAttribute('aria-label')).toBe('이벤트 오픈!\ngamevil.com')
    키('Escape')
    expect(니블()).toBe('0,3,0,0')
    expect(screen.getByTestId('장비-칸-0')).toBeTruthy()
  })

  it('칸 목록에서 다른 부위를 누르면 앞 부위의 끼워 보기를 진짜 니블로 되돌린다 (취소 0x81a9a 와 같게)', () => {
    띄우기([2, 0, 0, 0])
    fireEvent.click(screen.getByRole('button', { name: '부위 1' }))
    키('ArrowDown')
    키('ArrowDown')
    expect(니블()).toBe('3,0,0,0')
    fireEvent.click(screen.getByRole('button', { name: '부위 2' }))
    expect(니블()).toBe('2,1,0,0')
  })

  it('부위 목록에서 취소 → 0xdf', () => {
    const { onBack } = 띄우기()
    키('Escape')
    expect(onBack).toHaveBeenCalled()
  })
})
