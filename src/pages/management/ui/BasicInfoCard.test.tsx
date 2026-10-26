// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { BasicInfoCard } from '@/pages/management/ui/BasicInfoCard'
import { createCareer } from '@/entities/career/model/playerCareer'

/**
 * 기본정보 카드 선수 그림의 팔레트 — 0x10810 → 0x78ab0 (C-1 확정).
 * 몸통 = 피부 × 15 + 팀 (0x78be8) · 헬멧 = 팀 (0x78c14). 예전엔 구운 색 그대로였다.
 */

const 칠하기 = vi.hoisted(() => vi.fn((url: string, _palette: number | null) => url))
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

describe('정보 칸 숫자 — 0x7c450 비시즌 갈래', () => {
  it('타순은 num 숫자 그림이 아니라 시스템 글꼴 "%d" 노랑이다 (0x7cf58~0x7cfa0 0xba44d)', () => {
    const career = { ...createCareer('테스터'), battingOrder: 7 }

    const { container } = render(<BasicInfoCard career={career} />)

    const 타순 = Array.from(container.querySelectorAll('div')).find((node) => node.textContent === '7' && node.children.length === 0)
    expect(타순, '타순 글 칸이 없다').toBeDefined()
    expect((타순 as HTMLElement).style.color).toBe('rgb(255, 255, 0)')
    // numBox 0xba719 는 시즌(모드 2)만 — 나리 정보 칸(판 y 176~)에는 ui/num 그림이 없다 (레이더 능력치 숫자는 위쪽이다)
    const 칸숫자그림 = Array.from(container.querySelectorAll<HTMLElement>('img[src*="/num/"]'))
      .filter((node) => Number.parseFloat(node.style.top) >= 176)
    expect(칸숫자그림).toEqual([])
  })
})
