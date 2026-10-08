// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { HomeRunDerbyScreen } from '@/pages/home-run-derby/ui/HomeRunDerbyScreen'
import { ROOKIE_BATTER_ABILITY } from '@/entities/batting/model/batter'
import { createSeededRandom } from '@/shared/api/random/seededRandom'
import { LOADING_TIPS } from '@/shared/config/loadingTips'
import { rollSceneLoadingTip } from '@/entities/game/model/sceneLoadingTip'

/** 로딩 판이 받은 팁 글 — 그림 대신 그리자마자 끝낸다(상태 7 · 9 · 8 적재를 다 그린 꼴) */
const 받은팁: string[] = []
vi.mock('@/widgets/loading-tip/ui/LoadingTip', async () => {
  const { useEffect } = await import('react')
  return {
    LoadingTip: ({ tip, onDone }: { tip: string; onDone: () => void }) => {
      useEffect(() => {
        받은팁.push(tip)
        onDone()
      }, [])
      return null
    },
  }
})

// jsdom 에는 캔버스가 없다 — 타석 그리기는 컨텍스트가 없으면 스스로 멈춘다
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
  받은팁.length = 0
})

const 띄우기 = () =>
  render(
    <HomeRunDerbyScreen
      ability={ROOKIE_BATTER_ABILITY}
      random={createSeededRandom(1)}
      bestDistance={320}
      gamePoint={1_000}
      onExit={vi.fn()}
    />,
  )

describe('홈런더비 화면', () => {
  it('첫 그림은 로딩 판 — 팁은 상태 7 진입 0x53dbc 의 rand(0, 73) 칸 StrTIP[1 + n]', () => {
    띄우기()
    expect(받은팁).toEqual([LOADING_TIPS[rollSceneLoadingTip(createSeededRandom(1))]])
  })

  it('제목과 남은 공 표시가 뜬다 — 첫 공은 1 / 10구', () => {
    띄우기()
    expect(screen.getByText('홈런더비')).toBeTruthy()
    expect(screen.getByText('1 / 10구')).toBeTruthy()
  })

  it('첫 공 앞 0xd 두 그림 뒤 상태 0xe 에서 소개 판(0x44944)을 띄운다 — 투수 판 COM · 타자 판 PLAYER', async () => {
    띄우기()
    expect(screen.queryByTestId('소개판')).toBeNull()
    expect(await screen.findByTestId('소개판')).toBeTruthy()
    expect(screen.getByTestId('투수팀').getAttribute('src')).toBe('./sprites/img_text/frames/158.png')
    expect(screen.getByTestId('타자팀').getAttribute('src')).toBe('./sprites/img_text/frames/157.png')
  })

  it('HUD 판(trainning 프레임 2)과 최고 기록 칸을 함께 보여 준다', () => {
    띄우기()
    expect(screen.getByAltText('홈런더비 판')).toBeTruthy()
    expect(screen.queryAllByTestId('최고기록').length).toBeGreaterThan(0)
  })
})

describe('경기 중 메뉴 (표 0xcfcfc 행 1 — 자동진행 자리에 다시하기)', () => {
  // 메뉴 칸은 `MenuList` 가 `role="option"` 으로 그리고, **고른 칸에는 커서 `▶` 가 붙는다**
  // (소프트키만 role="button")
  it('메뉴 소프트키로 열고 닫는다', () => {
    띄우기()

    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))
    expect(screen.getByRole('option', { name: /계속/ })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(screen.queryByRole('option', { name: /계속/ })).toBeNull()
  })

  it('**다시하기** 칸이 있다 — 자동진행이 아니다 (홈런더비는 행 1)', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))

    expect(screen.getByRole('option', { name: '다시하기' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: /자동진행/ })).toBeNull()
  })

  it('설정을 안 넘기면 그 칸이 잠긴다', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))

    expect((screen.getByRole('option', { name: '설정' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('다시하기를 고르면 StrGAME[7] 로 되묻고, 예를 눌러야 처음부터 다시 선다', () => {
    띄우기()
    fireEvent.click(screen.getByRole('button', { name: '메뉴' }))
    fireEvent.click(screen.getByRole('option', { name: '다시하기' }))

    expect(screen.getByText(/다시 플레이하시겠습니까/)).toBeTruthy()

    const 예 = screen.getAllByRole('option').find((option) => option.textContent?.endsWith('예'))
    fireEvent.click(예!)
    // 처음부터 다시 — 첫 공으로 돌아온다
    expect(screen.getByText('1 / 10구')).toBeTruthy()
    // 새 경기 장면 — 로딩 판도 다시 선다(상태 7 진입 0x39f88)
    expect(받은팁).toHaveLength(2)
  })
})
