// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen as view } from '@testing-library/react'
import type { ComponentProps } from 'react'
import type { Screen } from '@/app/model/screen'
import { EMPTY_COLLECTION, registerHallOfFame } from '@/entities/collection/model/collection'
import { createCareer } from '@/entities/career/model/playerCareer'
import { modeBatterOf } from '@/app/model/modeBatter'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

/** 더비 화면이 받은 속성 — 그림은 여기서 볼 것이 아니라 갈아 끼운다 */
const 받은것: Record<string, unknown>[] = []
vi.mock('@/pages/home-run-derby/ui/HomeRunDerbyScreen', () => ({
  HomeRunDerbyScreen: (props: Record<string, unknown>) => {
    받은것.push(props)
    return null
  },
}))

const { EntryRoutes } = await import('@/app/ui/EntryRoutes')
type Props = ComponentProps<typeof EntryRoutes>

afterEach(() => {
  cleanup()
  받은것.length = 0
})

describe('홈런더비 진입 — 하위 16 선수 고르기 (0x25e6c · 0x29ac8)', () => {
  const 나리 = { ...createCareer('나리'), battingTypeIndex: 1, battingSide: 0, skinIndex: 2 }
  const 명전 = { ...createCareer('전설'), endingIndex: 4, battingTypeIndex: 2, battingSide: 1, skinIndex: 1, equippedSkillIds: [22], specialSwingNumber: 3 }
  const 등록결과 = registerHallOfFame(EMPTY_COLLECTION, 명전, 99_999)
  if (등록결과.kind !== '등록') throw new Error('등록 실패')
  const 명전기록 = 등록결과.collection

  function 띄우기(career: typeof 나리 | null) {
    const setScreen = vi.fn()
    const props = {
      screen: { kind: '홈런더비' } as Screen,
      setScreen,
      session: { career, savedCareer: null, actions: { gainGamePoint: vi.fn() } } as unknown as Props['session'],
      gameSettings: { settings: undefined, setSettings: vi.fn() } as unknown as Props['gameSettings'],
      collection: 명전기록,
      random: createSeededRandom(1),
      wallet: { balance: 0 } as unknown as Props['wallet'],
    }
    render(<EntryRoutes {...props} />)
    return { setScreen }
  }

  it('나리 타자(칸 5)를 고르면 나리 타자편 저장으로 친다', () => {
    띄우기(나리)
    expect(받은것).toHaveLength(0)
    fireEvent.click(view.getByRole('button', { name: '6번 슬롯' }))
    expect(받은것.at(-1)).toMatchObject({ ability: modeBatterOf(나리).ability, batterForm: 2, batterSkinIndex: 2 })
  })

  it('명예 타자(칸 6, 코드 4)를 고르면 그 기록으로 — 장착 스킬·생김새도 기록 것이다', () => {
    띄우기(나리)
    fireEvent.click(view.getByRole('button', { name: '7번 슬롯' }))
    expect(받은것.at(-1)).toMatchObject({ batterSkillIds: [22], batterForm: 5, batterSkinIndex: 1 })
  })

  it('나리 타자가 없어도 명예 타자로 들어갈 수 있고, 나리 칸은 StrCOMMON[38] 로 막힌다', () => {
    띄우기(null)
    fireEvent.click(view.getByRole('button', { name: '6번 슬롯' }))
    expect(view.getByText(/나만의리그 선수를/)).toBeTruthy()
    fireEvent.click(view.getByRole('button', { name: '확인' }))
    fireEvent.click(view.getByRole('button', { name: '7번 슬롯' }))
    expect(받은것.at(-1)).toMatchObject({ batterSkillIds: [22] })
  })

  it('되돌아가기는 메인 메뉴 (결과 0)', () => {
    const { setScreen } = 띄우기(나리)
    fireEvent.click(view.getByRole('button', { name: '되돌아가기' }))
    expect(setScreen).toHaveBeenCalledWith({ kind: '메인메뉴' })
  })
})
