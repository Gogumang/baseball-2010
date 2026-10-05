// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { BasicInfoCard } from '@/pages/management/ui/BasicInfoCard'
import { createCareer } from '@/entities/career/model/playerCareer'

/**
 * 기본정보 카드 선수 그림의 팔레트 — 0x10810 → 0x78ab0 (C-1 확정).
 * 몸통 = 피부 × 15 + 팀 (0x78be8) · 헬멧 = 팀 (0x78c14). 예전엔 구운 색 그대로였다.
 */

const 칠하기 = vi.hoisted(() => vi.fn((url: string) => url))
vi.mock('@/shared/lib/sprite/paletteSwap', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/shared/lib/sprite/paletteSwap')>()),
  useRecoloredSprite: 칠하기,
}))

afterEach(() => {
  cleanup()
  칠하기.mockClear()
})

const 벌 = (folder: string) => 칠하기.mock.calls.find(([url]) => url.startsWith(`${folder}/`))?.[1]

describe('기본정보 카드 선수 그림 팔레트', () => {
  it('몸통은 피부 × 15 + 팀, 헬멧은 팀 벌로 칠한다', () => {
    const career = { ...createCareer('테스터'), skinIndex: 2, teamId: 4, battingTypeIndex: 0 }

    render(<BasicInfoCard career={career} />)

    expect(벌('./sprites/batter_balancer/frames')).toBe(2 * 15 + 4)
    expect(벌('./sprites/batter_helmet/frames')).toBe(4)
  })
})
