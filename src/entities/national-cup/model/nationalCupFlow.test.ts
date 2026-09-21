import { describe, expect, it } from 'vitest'
import {
  NATIONAL_CUP_STATE,
  careerNationalCupRewardItems,
  careerNationalCupRewardOf,
  careerNationalTeamEventId,
  isCareerNationalCupYear,
  confirmNationalCupStandings,
  finishNationalCup,
  hiddenTeamsToOpen,
  isCareerNationalCupCallUp,
  isSeasonNationalCupYear,
  nationalCupEditionOf,
  nationalCupResultText,
  nationalCupRewardFor,
} from '@/entities/national-cup/model/nationalCupFlow'
import { createNationalCup } from '@/entities/national-cup/model/nationalCup'
import type { NationalCup } from '@/entities/national-cup/model/nationalCup'
import { NATIONAL_CUP_RUNNER_UP_TEXT_MONEY } from '@/entities/season-mode/model/seasonRewards'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 고정난수 = (value: number): RandomPort => ({
  next: () => 0,
  nextInRange: () => value,
  pick: (candidates) => candidates[0],
})

const 대회 = (overrides: Partial<NationalCup>): NationalCup => ({ ...createNationalCup(), ...overrides })

describe('출전 판정', () => {
  it('나만의리그는 올해 목표를 4개 이상 이뤄야 선발된다 (0xa3de8(S,3) > 3)', () => {
    expect(isCareerNationalCupCallUp(3)).toBe(false)
    expect(isCareerNationalCupCallUp(4)).toBe(true)
  })

  it('시즌모드는 연차 idx 가 짝수면 무조건 출전이다 (1·3·5·7·9년차)', () => {
    expect([0, 1, 2, 3].map(isSeasonNationalCupYear)).toEqual([true, false, true, false])
  })

  it('제 n 회 = (연차idx >> 1) + 1', () => {
    expect([0, 2, 4, 6, 8].map(nationalCupEditionOf)).toEqual([1, 2, 3, 4, 5])
  })

  it('나만의리그도 연차 idx 가 짝수인 해(1·3·5·7·9·11년차)에만 선발 판정을 한다 (0x10cec)', () => {
    expect([0, 1, 2, 3, 10, 11].map(isCareerNationalCupYear)).toEqual([true, false, true, false, true, false])
  })

  it('상태 133 은 목표 4개 이상이면 선발 461, 아니면 탈락 462 를 예약한다 (0x1a090)', () => {
    expect([0, 3].map(careerNationalTeamEventId)).toEqual([462, 462])
    expect([4, 5].map(careerNationalTeamEventId)).toEqual([461, 461])
  })

  it('상태 번호는 원본 값 그대로다', () => {
    expect(NATIONAL_CUP_STATE.나만의리그.순위).toBe(134)
    expect(NATIONAL_CUP_STATE.시즌모드.순위).toBe(243)
  })
})

describe('순위 화면 확인 키 0x19fdc · 0xe6f8', () => {
  it('경기가 남았으면 매치업으로 간다', () => {
    expect(confirmNationalCupStandings(createNationalCup(), 고정난수(0)).kind).toBe('다음경기')
  })

  it('대회가 끝났으면 결과 화면이고, 우승국이 대한민국인지로 갈린다', () => {
    const 우승 = confirmNationalCupStandings(대회({ stage: 0, champion: 10 }), 고정난수(0))
    const 탈락 = confirmNationalCupStandings(대회({ stage: 0, champion: 13 }), 고정난수(0))

    expect(우승).toMatchObject({ kind: '결과', isKoreaChampion: true })
    expect(탈락).toMatchObject({ kind: '결과', isKoreaChampion: false })
  })

  it('⚠️ 결승 날인데 대한민국이 결승에 없으면 경기 없이 동전 던지기로 끝난다 (원본 그대로)', () => {
    const 결승 = 대회({ stage: 1, finalists: [11, 13] })
    const 결과 = confirmNationalCupStandings(결승, 고정난수(0))

    expect(결과.kind).toBe('결과')
    if (결과.kind !== '결과') return
    expect(결과.cup.champion).toBe(13)
    expect(결과.isKoreaChampion).toBe(false)
  })

  it('대한민국이 결승에 있으면 결승 날에도 경기를 치른다', () => {
    expect(confirmNationalCupStandings(대회({ stage: 1, finalists: [10, 11] }), 고정난수(0)).kind).toBe('다음경기')
  })
})

describe('결과 문구 0x85e6c', () => {
  it('우승은 StrMODE[144] 문구다', () => {
    expect(nationalCupResultText(2, true, '대한민국')).toBe('[대한민국] 대표팀 제2회 국가대항전 우승!!')
  })

  it('⚠️ 원본 버그 그대로 — 결승에서 져도 "대표팀 탈락!!" 이다 (StrMODE[143])', () => {
    expect(nationalCupResultText(1, false, '일본')).toBe(
      '[대한민국] 대표팀 탈락!! [일본] 대표팀 제1회 국가대항전 우승!!',
    )
  })
})

describe('보상', () => {
  it('나만의리그 우승은 인기 +20 · 평판 +30 · 소지금 +20(2000만) · G +1000 이다 (0x1b92c)', () => {
    expect(careerNationalCupRewardOf(10)).toEqual({
      popularity: 20,
      reputation: 30,
      money: 20,
      gamePoint: 1000,
      messageId: 199,
    })
  })

  it('⚠️ 나만의리그엔 준우승 보상이 없다 — 결승에서 져도 빈손이다 (원본 그대로)', () => {
    const 결승패 = 대회({ stage: 0, finalists: [10, 11], champion: 11 })
    expect(nationalCupRewardFor('나만의리그', 결승패)).toEqual({
      popularity: 0,
      reputation: 0,
      money: 0,
      gamePoint: 0,
      messageId: 0,
    })
  })

  it('나만의리그 보상은 이벤트 보상 칸(0 인기도·1 평판·3 소지금·10 G포인트)으로 바뀐다', () => {
    expect(careerNationalCupRewardItems(careerNationalCupRewardOf(10))).toEqual([
      { kind: 0, value: 20 },
      { kind: 1, value: 30 },
      { kind: 3, value: 20 },
      { kind: 10, value: 1000 },
    ])
  })

  it('보상이 없으면 이벤트 보상 칸도 비어 있다', () => {
    expect(careerNationalCupRewardItems(careerNationalCupRewardOf(13))).toEqual([])
  })

  it('시즌모드는 seasonRewards 의 nationalCupRewardOf 를 그대로 쓴다', () => {
    const 우승 = 대회({ stage: 0, finalists: [10, 11], champion: 10 })
    expect(nationalCupRewardFor('시즌모드', 우승)).toEqual({
      popularity: 30,
      reputation: 40,
      money: 50,
      gamePoint: 1000,
      messageId: 199,
    })
  })

  it('⚠️ 시즌모드 준우승은 문구가 2500만인데 실제로는 2000만만 더한다 (원본 버그)', () => {
    const 결승패 = 대회({ stage: 0, finalists: [10, 11], champion: 11 })
    const 보상 = nationalCupRewardFor('시즌모드', 결승패)

    expect(보상.messageId).toBe(200)
    expect(보상.money).toBe(20)
    expect(NATIONAL_CUP_RUNNER_UP_TEXT_MONEY).toBe(25)
  })

  it('풀리그에서 탈락하면 두 모드 모두 보상이 없다', () => {
    const 탈락 = 대회({ stage: 0, finalists: [11, 13], champion: 13 })
    expect(nationalCupRewardFor('시즌모드', 탈락).messageId).toBe(0)
    expect(nationalCupRewardFor('나만의리그', 탈락).messageId).toBe(0)
  })
})

describe('히든 팀 열기 (J-1)', () => {
  it('출전만 해도 대한민국은 열린다', () => {
    expect(hiddenTeamsToOpen(createNationalCup())).toEqual([10])
  })

  it('대한민국이 우승하면 결승 상대도 열린다', () => {
    expect(hiddenTeamsToOpen(대회({ finalists: [10, 13], champion: 10 }))).toEqual([10, 13])
    expect(hiddenTeamsToOpen(대회({ finalists: [12, 10], champion: 10 }))).toEqual([10, 12])
  })

  it('대한민국이 결승에서 지면 상대는 열리지 않는다', () => {
    expect(hiddenTeamsToOpen(대회({ finalists: [10, 11], champion: 11 }))).toEqual([10])
  })
})

describe('대회 마무리', () => {
  it('우승·결승 진출 여부·보상·열리는 팀을 한 번에 내놓는다', () => {
    const 우승 = 대회({ stage: 0, finalists: [10, 12], champion: 10 })

    expect(finishNationalCup('시즌모드', 우승)).toEqual({
      champion: 10,
      isKoreaChampion: true,
      koreaInFinal: true,
      reward: { popularity: 30, reputation: 40, money: 50, gamePoint: 1000, messageId: 199 },
      openedTeams: [10, 12],
    })
  })
})
