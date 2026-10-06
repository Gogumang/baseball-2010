// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen as view } from '@testing-library/react'
import { useState } from 'react'
import { useAtBatRunner } from '@/app/model/useAtBatRunner'
import { useMissionSession } from '@/app/model/useMissionSession'
import { useGameSettings } from '@/app/model/useGameSettings'
import { MissionRoutes } from '@/app/ui/MissionRoutes'
import { modeBatterOf } from '@/app/model/modeBatter'
import type { Screen } from '@/app/model/screen'
import { EMPTY_COLLECTION } from '@/entities/collection/model/collection'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

afterEach(cleanup)

describe('미션 모드 진입 — 하위 17 선수 고르기를 먼저 띄운다 (0x2613c · 0x29a54)', () => {
  function 띄우기(
    nari: { 투수: { name: string; equippedAbility: number[] } | null; 타자: { name: string; equippedAbility: number[] } | null },
    gamePoint?: number,
  ) {
    const setScreenSpy = vi.fn()
    function Harness() {
      const [screen, setScreen] = useState<Screen>({ kind: '미션선택' })
      const runner = useAtBatRunner()
      const random = createSeededRandom(1)
      const gameSettings = useGameSettings({ load: () => null, save: () => {} })
      const session = useMissionSession({
        runner, random, missionRecord: { load: () => ({}), save: vi.fn() }, screen, setScreen, hallOfFame: EMPTY_COLLECTION,
      })
      const go = (next: Screen) => { setScreenSpy(next); setScreen(next) }
      return (
        <MissionRoutes screen={screen} setScreen={go} session={session} runner={runner} random={random}
          batter={modeBatterOf(null)} hallOfFame={EMPTY_COLLECTION} nari={nari}
          pitchControl="게이지" gameSettings={gameSettings} {...(gamePoint === undefined ? {} : { gamePoint })} />
      )
    }
    render(<Harness />)
    return { setScreenSpy, 슬롯: (index: number) => view.getByRole('button', { name: `${index + 1}번 슬롯` }) }
  }

  it('나리 타자(칸 5, 코드 2)를 고르면 타자 미션 목록 — 편 바꾸기 버튼이 없다', () => {
    const { 슬롯 } = 띄우기({ 투수: null, 타자: { name: '홍길동', equippedAbility: [500, 500, 500, 500] } })
    fireEvent.click(슬롯(5))
    expect(view.queryByRole('button', { name: '5번 슬롯' })).toBeNull()
    expect(view.queryByRole('button', { name: '투수편' })).toBeNull()
    expect(view.queryByRole('button', { name: '타자편' })).toBeNull()
  })

  it('나리 선수도 명예 선수도 없으면 들어갈 수 없다 — StrCOMMON[38] 만 (신인 대체 없음)', () => {
    const { 슬롯 } = 띄우기({ 투수: null, 타자: null })
    fireEvent.click(슬롯(5))
    expect(view.getByText(/나만의리그 선수를/)).toBeTruthy()
  })

  it('머리띠는 그리기 0x2dec8 의 0x54d95(skin, 11, 5) — 제목 11 "미션모드"(game_frame 18) + G포인트, 명예의 전당 띠가 아니다', () => {
    띄우기({ 투수: null, 타자: null }, 1234)
    const sources = [...document.querySelectorAll('img')].map((image) => image.getAttribute('src') ?? '')
    expect(sources.some((src) => src.endsWith('game_frame/018.png'))).toBe(true)
    expect(sources.some((src) => src.endsWith('game_frame/003.png'))).toBe(false)
    // 머리글 질문 StrMAINMENU[14] 는 하위 13(0x25d78) 몫이다 — 하위 17 은 안 띄운다
    expect(view.queryByText(/어떤 선수로 플레이/)).toBeNull()
    // 바닥 5 = 되돌아가기만
    expect(view.getByRole('button', { name: '되돌아가기' })).toBeTruthy()
  })

  it('되돌아가기는 결과 0 — 메인 메뉴로', () => {
    const { setScreenSpy } = 띄우기({ 투수: null, 타자: null })
    fireEvent.click(view.getByRole('button', { name: '되돌아가기' }))
    expect(setScreenSpy).toHaveBeenCalledWith({ kind: '메인메뉴' })
  })
})
