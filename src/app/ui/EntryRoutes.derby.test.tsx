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

  function 띄우기(career: typeof 나리 | null, recordStat = vi.fn(), isBatterHeld = false) {
    const setScreen = vi.fn()
    const props = {
      recordStat,
      aceMatchHold: { read: () => ({ batter: isBatterHeld, pitcher: false, originalMode: isBatterHeld ? 4 : 0 }), writeResult: vi.fn() },
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

  it('상태 0xe 소개 판의 타자 판 값을 넘긴다 — 나리 기록이면 이름·시즌 줄과 모드 타자 칸 k(+0xa & 0x1f), 명전 기록이면 이름만 · k = 0', () => {
    const 기록있는나리 = { ...나리, stats: { ...나리.stats, atBats: 20, hits: 7, homeRuns: 2, runsBattedIn: 5 } }
    띄우기(기록있는나리)
    fireEvent.click(view.getByRole('button', { name: '6번 슬롯' }))
    expect(받은것.at(-1)?.['matchupBatter']).toMatchObject({
      name: '나리',
      battingAverage: 350,
      homeRuns: 2,
      runsBattedIn: 5,
    })
    // 신인은 8번 타자 칸(첨자 7) — 타순 팀+0x32 = 0xb6394(기록), 화면이 타순(`derbyLineup`)에서 판에 채운다
    expect(받은것.at(-1)?.['modeBatterSlot']).toBe(7)
    cleanup()
    띄우기(나리)
    fireEvent.click(view.getByRole('button', { name: '7번 슬롯' }))
    expect(받은것.at(-1)?.['matchupBatter']).toEqual({ name: '전설' })
    expect(받은것.at(-1)?.['modeBatterSlot']).toBe(0)
  })

  it('명예 타자(칸 6, 코드 4)를 고르면 그 기록으로 — 장착 스킬·생김새도 기록 것이다', () => {
    띄우기(나리)
    fireEvent.click(view.getByRole('button', { name: '7번 슬롯' }))
    expect(받은것.at(-1)).toMatchObject({ batterSkillIds: [22], batterForm: 5, batterSkinIndex: 1 })
  })

  it('타자편 대결 대기(g[0x11f])가 서 있으면 명예 타자를 골라도 나리 타자편 저장 선수로 친다 (0x1fc20 1fc3c)', () => {
    띄우기(나리, vi.fn(), true)
    fireEvent.click(view.getByRole('button', { name: '7번 슬롯' }))
    expect(받은것.at(-1)).toMatchObject({ ability: modeBatterOf(나리).ability, batterForm: 2, batterSkinIndex: 2 })
    expect((받은것.at(-1)?.['matchupBatter'] as { name: string }).name).toBe('나리')
  })

  it('나리 타자가 없어도 명예 타자로 들어갈 수 있고, 나리 칸은 StrCOMMON[38] 로 막힌다', () => {
    띄우기(null)
    fireEvent.click(view.getByRole('button', { name: '6번 슬롯' }))
    expect(view.getByText(/나만의리그 선수를/)).toBeTruthy()
    fireEvent.click(view.getByRole('button', { name: '확인' }))
    fireEvent.click(view.getByRole('button', { name: '7번 슬롯' }))
    expect(받은것.at(-1)).toMatchObject({ batterSkillIds: [22] })
  })

  it('머리띠는 제목 14 "홈런더비"(game_frame 13) + G포인트 — 하위 16 그리기 0x2df20 의 0x54d95(skin, 14, 5)', () => {
    띄우기(나리)
    const srcs = [...document.querySelectorAll('img')].map((img) => img.getAttribute('src') ?? '')
    expect(srcs).toContain('./sprites/game_frame/013.png')
    expect(srcs).not.toContain('./sprites/game_frame/003.png')
    expect(srcs).toContain('./sprites/gpoint/011.png')
  })

  it('결과 정산은 지갑에 더한 뒤 기록연감 모드 7 획득 G 를 남긴다 (0x4f700 → 0x4f70a 0x22c7d(앱, 번 G, 7))', () => {
    const recordStat = vi.fn()
    띄우기(나리, recordStat)
    fireEvent.click(view.getByRole('button', { name: '6번 슬롯' }))
    const onFinish = 받은것.at(-1)?.onFinish as (result: { bestDistance: number; gainedGamePoint: number }) => void
    onFinish({ bestDistance: 0, gainedGamePoint: 123 })
    expect(recordStat).toHaveBeenCalledWith({ kind: 'G획득', mode: 7, amount: 123 })
  })

  it('되돌아가기는 결과 0 — 같은 장면의 하위 5 게임시작 목록으로, 띠는 이미 다 자랐다 (0x29ac8)', () => {
    const { setScreen } = 띄우기(나리)
    fireEvent.click(view.getByRole('button', { name: '되돌아가기' }))
    expect(setScreen).toHaveBeenCalledWith({ kind: '메인메뉴', openTier: 5, isBandGrown: true })
  })
})
