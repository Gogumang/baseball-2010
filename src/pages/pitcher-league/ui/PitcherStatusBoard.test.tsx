// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { createPitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import { PitcherStatusBoard, pitcherStatusIconStateOf, staminaBarLayoutOf } from '@/pages/pitcher-league/ui/PitcherStatusBoard'
import { statusIconFramesFrom } from '@/pages/management/ui/StatusIconRow'

/** 투수편도 상태판 0x7d34c 끝의 상태 아이콘 줄(0x7dd46~0x7df92)을 탄다 — 모드 3 은 갈림 없이 다섯을 본다 */

afterEach(cleanup)

const iconsOf = (container: HTMLElement) =>
  [...container.querySelectorAll('img')].filter((img) => /mode_ui\/frames\/(08[5-8]|091)\.png$/.test(img.src))

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

describe('스태미나 막대 0x7d80e~0x7d9c4 · 사기 y −3', () => {
  it('칸 (194, 54, 42, 7) · 안칸 (195, 55, 40, 5) · 폭 = trunc(trunc(s × M / 10000) × 40 / M) · 이름표 396 은 칸 왼쪽 밖', () => {
    const career = { ...createPitcherCareer('테스터'), stamina: 4_250 }
    const bar = staminaBarLayoutOf(career)
    expect([bar.outer, bar.inner]).toEqual([
      { x: 194, y: 54, width: 42, height: 7 }, { x: 195, y: 55, width: 40, height: 5 },
    ])
    expect(bar.label).toEqual({ left: 146, top: 55 })
    expect(bar.filled).toBe(16)
    expect(staminaBarLayoutOf({ ...career, stamina: 10_000 }).filled).toBe(40)
    expect(staminaBarLayoutOf({ ...career, stamina: 0 }).filled).toBe(0)
  })

  it('사기 이름표 · 막대는 3 위로 (0x7d652 · 0x7d706)', () => {
    const { container } = render(<PitcherStatusBoard career={createPitcherCareer('테스터')} />)
    const 사기 = [...container.querySelectorAll('img')].find((img) => img.src.endsWith('img_text/frames/084.png')) as HTMLElement
    expect(사기.style.top).toBe('41px')
  })
})
