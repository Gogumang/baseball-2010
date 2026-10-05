// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { createCareer } from '@/entities/career/model/playerCareer'
import { StatusValues, statusIconFramesOf } from '@/pages/management/ui/StatusValues'

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
