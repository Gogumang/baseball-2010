// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen as view } from '@testing-library/react'
import type { ComponentProps } from 'react'
import type { Screen } from '@/app/model/screen'
import { EMPTY_COLLECTION } from '@/entities/collection/model/collection'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { millisecondsPerFrame } from '@/shared/config/frameRate'
import { EntryRoutes } from '@/app/ui/EntryRoutes'

type Props = ComponentProps<typeof EntryRoutes>

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

function 띄우기(claimCollectionReward: () => string | null) {
  const props = {
    screen: { kind: '메인메뉴' } as Screen,
    setScreen: vi.fn(),
    session: { career: null, savedCareer: null, actions: {} } as unknown as Props['session'],
    gameSettings: { settings: undefined, setSettings: vi.fn() } as unknown as Props['gameSettings'],
    collection: EMPTY_COLLECTION,
    random: createSeededRandom(1),
    wallet: { balance: 0 } as unknown as Props['wallet'],
    claimCollectionReward,
  }
  return render(<EntryRoutes {...props} />)
}

describe('메인 메뉴 전부 수집 보상 — 하위 4 열 번째 갱신에 0x28e98, 팝업 0x292f8 을 닫으면 곧 다시', () => {
  it('열 번째 갱신 전에는 판정하지 않는다', () => {
    const claim = vi.fn(() => null)
    띄우기(claim)
    act(() => { vi.advanceTimersByTime(millisecondsPerFrame() * 10 - 1) })
    expect(claim).not.toHaveBeenCalled()
    act(() => { vi.advanceTimersByTime(1) })
    expect(claim).toHaveBeenCalledTimes(1)
    expect(view.queryByRole('dialog')).toBeNull()
  })

  it('받을 것이 있으면 팝업을 띄우고, 닫을 때마다 다음 것을 하나씩 판정한다', () => {
    const texts = ['미션모드 모두 성공달성!N[!cFFFF0030000 G포인트!cFFFFFF] 지급', '기록달성 모두 성공 달성!N[!cFFFF0040000 G포인트!cFFFFFF] 지급']
    const claim = vi.fn(() => texts.shift() ?? null)
    띄우기(claim)
    act(() => { vi.advanceTimersByTime(millisecondsPerFrame() * 10) })
    expect(view.getByRole('dialog').textContent).toContain('30000 G포인트')

    fireEvent.click(view.getByRole('button', { name: 'OK' }))
    expect(claim).toHaveBeenCalledTimes(2)
    expect(view.getByRole('dialog').textContent).toContain('40000 G포인트')

    fireEvent.click(view.getByRole('button', { name: 'OK' }))
    expect(claim).toHaveBeenCalledTimes(3)
    expect(view.queryByRole('dialog')).toBeNull()
  })
})
