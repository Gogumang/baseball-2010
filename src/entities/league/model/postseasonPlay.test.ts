import { describe, expect, it } from 'vitest'
import { playCpuSeriesGame, runCpuPostseason } from '@/entities/league/model/postseasonPlay'
import { startPostseason } from '@/entities/league/model/league'
import type { RandomPort } from '@/shared/api/random/randomPort'

function 씨앗난수(seed: number): RandomPort {
  let state = seed
  return {
    next: () => {
      state = (state * 1103515245 + 12345) % 2147483648
      return state / 2147483648
    },
    nextInRange: (minimum, maximum) => minimum + (maximum - minimum) / 2,
    pick: (candidates) => candidates[0],
  }
}

const 순위 = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]

describe('playCpuSeriesGame — 시리즈 한 경기 (0xc2760)', () => {
  it('한 경기를 치르면 어느 한쪽 승수가 하나 는다', () => {
    const 시작 = startPostseason(순위)
    const 뒤 = playCpuSeriesGame(시작, 씨앗난수(7))

    expect(뒤.wins[0] + 뒤.wins[1]).toBe(1)
  })

  it('끝난 시리즈에는 아무 일도 하지 않는다', () => {
    const 끝난것 = { ...startPostseason(순위), round: '종료' as const }

    expect(playCpuSeriesGame(끝난것, 씨앗난수(1))).toBe(끝난것)
  })
})

describe('runCpuPostseason — 내 차례까지 자동 소화 (0x13da0)', () => {
  it('내 팀이 준PO 에 있으면 한 경기도 돌리지 않는다', () => {
    const 시작 = startPostseason(순위)
    // 준PO 는 3위 vs 4위 = 팀 2·3
    expect(runCpuPostseason(시작, 2, 씨앗난수(9))).toBe(시작)
    expect(runCpuPostseason(시작, 3, 씨앗난수(9))).toBe(시작)
  })

  it('내 팀이 1위면 준PO·PO 가 끝나고 한국시리즈에서 멈춘다', () => {
    const 결과 = runCpuPostseason(startPostseason(순위), 0, 씨앗난수(2010))

    expect(결과.round).toBe('한국시리즈')
    expect(결과.teams[0]).toBe(0)
    expect(결과.wins).toEqual([0, 0])
  })

  it('내 팀이 진출하지 못했으면 우승이 정해질 때까지 돌린다', () => {
    const 결과 = runCpuPostseason(startPostseason(순위), 9, 씨앗난수(4242))

    expect(결과.round).toBe('종료')
    expect(결과.champion).not.toBeNull()
    // 우승팀은 진출한 네 팀 중 하나다
    expect([0, 1, 2, 3]).toContain(결과.champion)
  })

  it('같은 씨앗이면 같은 포스트시즌이 나온다', () => {
    expect(runCpuPostseason(startPostseason(순위), 9, 씨앗난수(77)))
      .toEqual(runCpuPostseason(startPostseason(순위), 9, 씨앗난수(77)))
  })
})
