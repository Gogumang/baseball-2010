// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PitcherStatusBoard, pitcherStatusIconStateOf } from '@/pages/pitcher-league/ui/PitcherStatusBoard'
import { statusIconFramesFrom } from '@/pages/management/ui/StatusIconRow'

/** 투수편도 상태판 0x7d34c 끝의 상태 아이콘 줄(0x7dd46~0x7df92)을 탄다 — 모드 3 은 갈림 없이 다섯을 본다 */

afterEach(cleanup)

const iconsOf = (container: HTMLElement) =>
  [...container.querySelectorAll('img')].filter((img) => img.src.includes('mode_ui/frames/'))

describe('투수편 상태 아이콘 — 행운 91 · 질병 86 · 부상 87 · 무력감 88', () => {
  it('행운(6)은 장착 비트로, 무력감(5)은 보유 비트로 본다', () => {
    const base = createPitcherCareer('테스터')
    const framesOf = (overrides: Partial<typeof base>) =>
      statusIconFramesFrom(pitcherStatusIconStateOf({ ...base, ...overrides }))
    expect(framesOf({ skillIds: [6], equippedSkillIds: [] })).toEqual([])
    expect(framesOf({ skillIds: [6], equippedSkillIds: [6] })).toEqual([91])
    expect(framesOf({ skillIds: [5], equippedSkillIds: [] })).toEqual([88])
  })

  it('켜진 것만 원본 차례대로 22px 간격으로 놓고, 없으면 줄을 안 그린다', () => {
    const base = createPitcherCareer('테스터')
    const quiet = render(<PitcherStatusBoard career={{ ...base, skillIds: [], equippedSkillIds: [] }} />)
    expect(iconsOf(quiet.container)).toEqual([])
    cleanup()

    const career = { ...base, skillIds: [5, 6], equippedSkillIds: [6], isSick: true, isInjured: true }
    const { container } = render(<PitcherStatusBoard career={career} />)
    expect(iconsOf(container).map((img) => [img.src.slice(-7, -4), img.style.left])).toEqual([
      ['091', '4px'], ['086', '26px'], ['087', '48px'], ['088', '70px'],
    ])
  })
})
