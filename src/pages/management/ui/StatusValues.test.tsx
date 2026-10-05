// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { createCareer } from '@/entities/career/model/playerCareer'
import { StatusValues, statusIconFramesOf } from '@/pages/management/ui/StatusValues'
import { eagleEyeDigitsOf } from '@/pages/management/ui/StatusIconRow'

/** 상태판 0x7d34c 끝의 상태 아이콘 줄 (0x7dd46~0x7df92) */

afterEach(cleanup)

describe('상태 아이콘 — 행운 91 · 이글아이 85 · 질병 86 · 부상 87 · 무력감 88 차례', () => {
  it('행운(6)은 장착 비트로, 무력감(5)은 보유 비트로 본다', () => {
    const base = createCareer('테스터')
    expect(statusIconFramesOf({ ...base, skillIds: [0, 8, 6], equippedSkillIds: [0, 8] })).toEqual([])
    expect(statusIconFramesOf({ ...base, skillIds: [0, 8, 6], equippedSkillIds: [0, 8, 6] })).toEqual([91])
    expect(statusIconFramesOf({ ...base, skillIds: [5], equippedSkillIds: [] })).toEqual([88])
  })

  it('다섯이 다 켜지면 원본 차례대로 22px 간격으로 놓인다', () => {
    const career = {
      ...createCareer('테스터'), skillIds: [5, 6], equippedSkillIds: [5, 6],
      eagleEyeGamesRemaining: 3, isSick: true, isInjured: true,
    }
    expect(statusIconFramesOf(career)).toEqual([91, 85, 86, 87, 88])

    const { container } = render(<StatusValues career={career} />)
    const icons = [...container.querySelectorAll('img')].filter((img) => img.src.includes('mode_ui/frames/'))
    expect(icons.map((img) => [img.src.slice(-7, -4), img.style.left, img.style.top])).toEqual([
      ['091', '4px', '45px'], ['085', '26px', '45px'], ['086', '48px', '45px'], ['087', '70px', '45px'], ['088', '92px', '45px'],
    ])
  })
})

describe('이글아이 남은 경기 수 — 0xba719(자간 0, 기준 0, ui/num, 정렬 0x44)', () => {
  const slot = { x: 26, y: 45, width: 20, height: 19 }

  it('num 0~9 를 폭(1 만 4px, 나머지 8px) 그대로 이어 박스 오른쪽 아래에 붙인다', () => {
    expect(eagleEyeDigitsOf(20, slot)).toEqual([
      { frame: 2, left: 30, top: 54 }, { frame: 0, left: 38, top: 54 },
    ])
    expect(eagleEyeDigitsOf(19, slot)).toEqual([
      { frame: 1, left: 34, top: 54 }, { frame: 9, left: 38, top: 54 },
    ])
    expect(eagleEyeDigitsOf(7, slot)).toEqual([{ frame: 7, left: 38, top: 54 }])
  })

  it('이글아이 칸에만 겹쳐 찍고, 칸 x 는 앞의 아이콘만큼 밀린다', () => {
    const career = { ...createCareer('테스터'), skillIds: [6], equippedSkillIds: [6], eagleEyeGamesRemaining: 15 }
    const { container } = render(<StatusValues career={career} />)
    const digits = [...container.querySelectorAll('img')].filter((img) => img.src.includes('/sprites/num/00'))
    expect(digits.map((img) => [img.src.slice(-7, -4), img.style.left, img.style.top])).toEqual([
      ['001', '34px', '54px'], ['005', '38px', '54px'],
    ])
  })
})
