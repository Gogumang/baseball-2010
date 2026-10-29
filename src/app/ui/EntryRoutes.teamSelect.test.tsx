// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { ComponentProps } from 'react'
import type { Screen } from '@/app/model/screen'
import { EMPTY_COLLECTION } from '@/entities/collection/model/collection'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { EntryRoutes } from '@/app/ui/EntryRoutes'

// 들어올 때 연출(머리띠 다섯 그림 · 격자 열림 애니 0x79fa8)과 그동안의 키 막음(`useListPageEntry`)은 따로 시험한다 — 여기서는 다 연 뒤로 본다
vi.mock('@/widgets/screen-frame/model/useListPageEntry', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/widgets/screen-frame/model/useListPageEntry')>()
  return { ...actual, useListPageEntry: actual.settledListPageEntry }
})

// 머리띠가 미끄러지는 다섯 그림 동안의 키 막음(`useFrameSlideKeyLock`)은 따로 시험한다 — 여기서는 다 내려온 뒤로 본다
vi.mock('@/widgets/screen-frame/model/useFrameSlideKeyLock', () => ({ useFrameSlideKeyLock: () => ({ current: false }) }))

type Props = ComponentProps<typeof EntryRoutes>

afterEach(cleanup)

describe('나리 101 팀 고르기 취소 — 0x14114 1424c~14264', () => {
  it('[0x140006c] = 5 — 메인 메뉴를 게임시작 목록(하위 5)으로 바로 연다', () => {
    const setScreen = vi.fn()
    render(
      <EntryRoutes
        screen={{ kind: '팀선택' } as Screen}
        setScreen={setScreen}
        session={{ career: null, savedCareer: null, actions: {} } as unknown as Props['session']}
        gameSettings={{ settings: undefined, setSettings: vi.fn() } as unknown as Props['gameSettings']}
        collection={EMPTY_COLLECTION}
        random={createSeededRandom(1)}
        wallet={{ balance: 0 } as unknown as Props['wallet']}
      />,
    )

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(setScreen).toHaveBeenCalledWith({ kind: '메인메뉴', openTier: 5 })
  })
})
