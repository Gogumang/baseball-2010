// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SkillWindow } from '@/widgets/skill-window/ui/SkillWindow'
import type { SkillWindowCareer } from '@/widgets/skill-window/ui/SkillWindow'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'

/** 아이템/스킬 창 — 하위 상태 122 (키 0x13140 → 0x819ad, 대화 0x147b0, 그리기 0x81dc0 종류 0) */

afterEach(cleanup)

const 선수 = (part: Partial<SkillWindowCareer> = {}): SkillWindowCareer => ({
  skillIds: [0, 8], equippedSkillIds: [0, 8], skillSlotLevel: 0, gamePoint: 0, subItemIds: [], ...part,
})
const 키 = (key: string) => fireEvent.keyDown(window, { key })
const 알림글 = () => stripGameMarkup(screen.getByRole('dialog', { name: '알림' }).textContent ?? '').replace(/\s+/g, '')
const 칸이름들 = () => screen.getAllByRole('button')
  .map((button) => button.getAttribute('aria-label') ?? '')
  .filter((name) => !['스킬', '서브아이템'].includes(name))

function 띄우기(career = 선수(), handlers: Partial<{ onEquip: () => void; onExpandSlots: () => void; onClose: () => void }> = {}) {
  const onEquip = handlers.onEquip ?? vi.fn()
  const onClose = handlers.onClose ?? vi.fn()
  render(<SkillWindow career={career} onEquip={onEquip} onExpandSlots={handlers.onExpandSlots ?? vi.fn()} onClose={onClose} />)
  return { onEquip, onClose }
}

describe('목록·배치', () => {
  it('보유 스킬을 번호 차례로 늘어놓는다 — 얻은 차례가 아니다 (0x81618)', () => {
    띄우기(선수({ skillIds: [8, 0, 6], equippedSkillIds: [8, 0] }))

    expect(칸이름들()).toEqual(['병아리', '행운', '의외성'])
  })

  it('네 줄째부터는 굴려서 보인다 — 아래로 세 번 가면 맨 윗행이 1 이 된다 (0x6c2bd)', () => {
    const many = [0, 1, 2, 3, 6, 7, 8, 9, 10, 11, 12, 13, 14]
    띄우기(선수({ skillIds: many, equippedSkillIds: [] }))
    expect(칸이름들()).not.toContain('우완UP')

    키('Enter') // 탭 → 격자
    키('ArrowDown')
    키('ArrowDown')
    키('ArrowDown')

    expect(칸이름들()[0]).toBe('행운')
    expect(칸이름들()).toContain('우완UP')
  })
})

describe('키 — 탭과 격자', () => {
  it('처음엔 탭에 있고 확인이 격자로 들어간다. 격자에서 확인하면 (0,0) 칸의 장착 질문이 뜬다', () => {
    띄우기()

    키('Enter')
    expect(screen.queryByRole('dialog', { name: '알림' })).toBeNull()
    키('Enter')

    expect(알림글()).toContain('[병아리')
    expect(알림글()).toContain('해제하시겠습니까')
  })

  it('격자에서 취소하면 탭으로 돌아가고, 탭에서 취소해야 창이 닫힌다 (0x13140 −16)', () => {
    const { onClose } = 띄우기()
    키('Enter')

    키('Escape')
    expect(onClose).not.toHaveBeenCalled()
    키('Escape')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('대화를 닫으면 창과 격자 커서가 그대로 남는다 — 다시 확인하면 같은 칸이다 (0x147b0 은 상태를 안 바꾼다)', () => {
    띄우기()
    키('Enter')
    키('ArrowRight')
    키('Enter')
    fireEvent.click(screen.getByRole('button', { name: '아니오' }))

    키('Enter')
    expect(알림글()).toContain('[의외성')
  })

  it('확장 질문에 "아니오" 면 지금 상한으로 StrMODE[132] 알림을 띄운다 (0x1497a)', () => {
    const plus = [0, 1, 6, 7, 8, 9]
    띄우기(선수({ skillIds: [...plus, 10], equippedSkillIds: plus, gamePoint: 6000 }))

    fireEvent.click(screen.getByRole('button', { name: '해결사' }))
    expect(알림글()).toContain('5000')
    fireEvent.click(screen.getByRole('button', { name: '아니오' }))

    expect(알림글()).toContain('최대6개')
  })
})

describe('서브아이템 탭', () => {
  it('오른쪽으로 탭을 바꾸면 가진 칸만 아이콘·이름을 갖고, 격자에 들어가면 그 칸 설명이 박스 4 에 뜬다', () => {
    띄우기(선수({ subItemIds: [0, 6] }))

    키('ArrowRight')
    expect(칸이름들()).toContain('표적판')
    expect(칸이름들()).toContain('외식회원증')
    expect(칸이름들()).toContain('빈 칸 2')

    키('Enter')
    const text = screen.getByTestId('skill-description').textContent ?? ''
    expect(text).toContain('표적판을 보니')
    expect(text).toContain('히트 훈련 시 +2')
  })

  it('투수편은 0~3 의 능력치 이름이 StrMODE[40+i] 다', () => {
    render(<SkillWindow career={선수({ subItemIds: [1] })} side="투수" onEquip={vi.fn()} onExpandSlots={vi.fn()} onClose={vi.fn()} />)

    키('ArrowRight')
    키('Enter')
    키('ArrowRight')

    expect(screen.getByTestId('skill-description').textContent).toContain('구속 훈련 시 +2')
  })
})
