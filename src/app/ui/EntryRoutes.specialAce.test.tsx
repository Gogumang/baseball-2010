// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen as view } from '@testing-library/react'
import type { ComponentProps, ReactNode } from 'react'
import type { Screen } from '@/app/model/screen'
import { EMPTY_COLLECTION } from '@/entities/collection/model/collection'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

/** 스페셜 화면 대신 — 마선수선택 칸을 곧장 연 꼴로 `renderAceSelect` 를 그린다 */
vi.mock('@/pages/special/ui/SpecialScreen', () => ({
  SpecialScreen: ({ renderAceSelect }: { renderAceSelect?: (onBack: () => void) => ReactNode }) => <>{renderAceSelect?.(() => undefined)}</>,
  HallOfFameScreen: () => null,
}))

/** 마선수 고르기 화면이 받은 속성 — 밑판(underlay)만 그린다 */
vi.mock('@/pages/general-mode', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/pages/general-mode')>()
  return { ...actual, AceSelectScreen: ({ underlay }: { underlay?: ReactNode }) => <>{underlay}</> }
})

const { EntryRoutes } = await import('@/app/ui/EntryRoutes')
type Props = ComponentProps<typeof EntryRoutes>

afterEach(cleanup)

describe('스페셜 마선수선택 (메인 메뉴 하위 28)', () => {
  it('그리기 0x2df78 처럼 메뉴 바탕 0x58371 을 먼저 깐다 — 검정 바탕이 아니다', () => {
    const props = {
      recordStat: vi.fn(),
      aceMatchHold: { read: () => ({ batter: false, pitcher: false, originalMode: 0 }), writeResult: vi.fn() },
      screen: { kind: '스페셜' } as Screen,
      setScreen: vi.fn(),
      session: { career: null, savedCareer: null, actions: { gainGamePoint: vi.fn() } } as unknown as Props['session'],
      gameSettings: { settings: undefined, setSettings: vi.fn() } as unknown as Props['gameSettings'],
      collection: EMPTY_COLLECTION,
      random: createSeededRandom(1),
      wallet: { balance: 0 } as unknown as Props['wallet'],
      aceSelect: {
        openedAcePitcherIds: [],
        openedAceBatterIds: [],
        levels: {},
        onOpenAce: vi.fn(),
        onLevelUp: vi.fn(),
      } as unknown as Props['aceSelect'],
    }
    render(<EntryRoutes {...props} />)
    expect(view.getByTestId('바탕-메뉴')).toBeTruthy()
  })
})
