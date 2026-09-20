// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NationalCupScreen } from '@/pages/national-cup/ui/NationalCupScreen'
import { createNationalCup } from '@/entities/national-cup/model/nationalCup'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import type { NationalCupMode } from '@/entities/national-cup/model/nationalCupFlow'
import type { RandomPort } from '@/shared/api/random/randomPort'

/**
 * 국가대항전 한 바퀴 — 순위 → 매치업 → (경기) → … → 결과 팝업 → 보상 팝업.
 * 원본 상태로는 `134 → 135 → 142 → … → 134 키` (나리) / `243 → 244 → 221 → … → 243 키` (시즌)다.
 */

afterEach(cleanup)

const 고정난수 = (value: number): RandomPort => ({
  next: () => 0,
  nextInRange: () => value,
  pick: (candidates) => candidates[0],
})

const 띄우기 = (
  cup: NationalCup,
  overrides: {
    mode?: NationalCupMode
    yearIndex?: number
    random?: RandomPort
    onStartGame?: () => void
    onFinish?: () => void
  } = {},
) =>
  render(
    <NationalCupScreen
      mode={overrides.mode ?? '시즌모드'}
      cup={cup}
      yearIndex={overrides.yearIndex ?? 2}
      random={overrides.random ?? 고정난수(0)}
      onStartGame={overrides.onStartGame ?? vi.fn()}
      onFinish={overrides.onFinish ?? vi.fn()}
    />,
  )

const 확인 = () => fireEvent.click(screen.getByRole('button', { name: '확인' }))

describe('경기가 남았을 때', () => {
  it('순위 화면에서 확인하면 매치업이 뜨고, 거기서 경기로 넘어간다', () => {
    const onStartGame = vi.fn()
    띄우기(createNationalCup(), { onStartGame })

    expect(screen.getByRole('group', { name: '국가대항전 순위' })).toBeTruthy()
    확인()
    expect(screen.getByRole('group', { name: '국가대항전 대진' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: '경기 시작' }))
    expect(onStartGame).toHaveBeenCalledTimes(1)
    expect(onStartGame.mock.calls[0][0]).toEqual({ myTeam: 10, opponent: 11 })
  })
})

describe('대회가 끝났을 때', () => {
  const 우승: NationalCup = { ...createNationalCup(), stage: 0, finalists: [10, 12], champion: 10 }
  const 결승패: NationalCup = { ...createNationalCup(), stage: 0, finalists: [10, 11], champion: 11 }
  const 탈락: NationalCup = { ...createNationalCup(), stage: 0, finalists: [11, 13], champion: 13 }

  it('우승이면 StrMODE[144] 문구 뒤 보상 팝업이 뜨고 끝난다', () => {
    const onFinish = vi.fn()
    띄우기(우승, { yearIndex: 2, onFinish })

    확인()
    expect(screen.getByText(/제2회 국가대항전 우승!!/)).toBeTruthy()
    확인()
    expect(screen.getByText(/5000만원/)).toBeTruthy()
    확인()

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({
      isKoreaChampion: true,
      openedTeams: [10, 12],
      reward: { popularity: 30, reputation: 40, money: 50, gamePoint: 1000, messageId: 199 },
    })
  })

  it('⚠️ 결승에서 져도 문구는 "대표팀 탈락!!" 이다 (원본 버그)', () => {
    띄우기(결승패)
    확인()

    expect(screen.getByText(/대표팀 탈락!!/)).toBeTruthy()
    expect(screen.getByText(/\[일본\]/)).toBeTruthy()
  })

  it('⚠️ 시즌모드 준우승 보상 글은 2500만인데 실제로 더하는 값은 2000만이다 (원본 버그)', () => {
    const onFinish = vi.fn()
    띄우기(결승패, { onFinish })

    확인()
    확인()
    expect(screen.getByText(/2500만원/)).toBeTruthy()
    확인()

    expect(onFinish.mock.calls[0][0].reward).toMatchObject({ money: 20, messageId: 200 })
  })

  it('풀리그에서 탈락하면 보상 팝업 없이 곧장 끝난다', () => {
    const onFinish = vi.fn()
    띄우기(탈락, { onFinish })

    확인()
    확인()

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0].reward.messageId).toBe(0)
  })

  it('⚠️ 나만의리그엔 준우승 보상이 없어 결승에서 져도 바로 끝난다 (원본 그대로)', () => {
    const onFinish = vi.fn()
    띄우기(결승패, { mode: '나만의리그', onFinish })

    확인()
    확인()

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0].reward.messageId).toBe(0)
  })
})

describe('⚠️ 대한민국이 결승에 못 갔을 때 (원본 그대로)', () => {
  it('결승 날 확인을 누르면 경기 없이 동전 던지기로 우승국이 정해진다', () => {
    const onFinish = vi.fn()
    const 결승: NationalCup = { ...createNationalCup(), stage: 1, finalists: [11, 13] }
    // rand(0,2) == 0 → L+0xaf(2위) 미국이 우승
    띄우기(결승, { random: 고정난수(0), onFinish })

    확인()
    expect(screen.getByText(/\[미국\]/)).toBeTruthy()
    확인()

    expect(onFinish).toHaveBeenCalledTimes(1)
    expect(onFinish.mock.calls[0][0]).toMatchObject({ champion: 13, koreaInFinal: false })
  })
})
