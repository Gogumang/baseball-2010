// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render } from '@testing-library/react'
import type { ComponentProps } from 'react'
import type { Screen } from '@/app/model/screen'
import { EMPTY_COLLECTION } from '@/entities/collection/model/collection'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { EntryRoutes } from '@/app/ui/EntryRoutes'

type Props = ComponentProps<typeof EntryRoutes>

afterEach(cleanup)

describe('나리 101 팀 고르기 취소 — 0x14114 1424c~14264', () => {
  it('[0x140006c] = 5 — 메인 메뉴를 게임시작 목록(하위 5)으로 바로 연다', () => {
    const setScreen = vi.fn()
    render(<EntryRoutes
      screen={{ kind: '팀선택' } as Screen}
      setScreen={setScreen}
      session={{ career: null, savedCareer: null, actions: {} } as unknown as Props['session']}
      gameSettings={{ settings: undefined, setSettings: vi.fn() } as unknown as Props['gameSettings']}
      collection={EMPTY_COLLECTION}
      random={createSeededRandom(1)}
      wallet={{ balance: 0 } as unknown as Props['wallet']}
    />)

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(setScreen).toHaveBeenCalledWith({ kind: '메인메뉴', openTier: 5 })
  })
})
