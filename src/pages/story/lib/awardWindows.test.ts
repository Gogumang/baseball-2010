import { describe, expect, it } from 'vitest'
import { awardWindowTextOf, mvpWindowTextOf, titleWindowTextOf } from '@/pages/story/lib/awardWindows'
import type { SeasonAwards, TitleSlot } from '@/entities/awards/model/seasonAwards'

const 칸 = (overrides: Partial<TitleSlot>): TitleSlot => ({
  name: '홈런왕',
  kind: 9,
  userEventIndex: 76,
  teamId: 0,
  winnerName: '',
  isMine: false,
  ...overrides,
} as TitleSlot)

const 시상 = (titles: readonly TitleSlot[], isMostValuablePlayer = false): SeasonAwards => ({
  titles,
  wonCount: titles.filter((title) => title.isMine).length,
  isMostValuablePlayer,
  mostValuablePlayer: null,
})

const 나 = { teamId: 4, name: '홍길동' }

describe('타이틀 발표 창 0x8b3bc', () => {
  it('"!C" 뒤에 칸마다 문구 · 팀 · 이름 — 팀 10(자격자 없음) 칸은 빠진다', () => {
    const text = titleWindowTextOf(
      시상([
        칸({ userEventIndex: 76, teamId: 4, winnerName: '홍길동', isMine: true }),
        칸({ name: '타점왕', userEventIndex: 77, teamId: 1, winnerName: '김철수' }),
        칸({ name: '타율왕', userEventIndex: 78, teamId: 10, winnerName: '' }),
      ]),
    )
    expect(text).toBe(
      '!C' +
        '[!cFFFF00홈런왕!cFFFFFF] 선정!N대구 라이온즈 홍길동!N!N' +
        '[!cFFFF00타점왕!cFFFFFF] 선정!N서울 피닉스 김철수!N!N',
    )
  })

  it('마무리면 첫 칸이 세이브왕(82)이다 — 칸이 든 문구 번호 그대로', () => {
    expect(titleWindowTextOf(시상([칸({ name: '세이브왕', userEventIndex: 82, teamId: 2, winnerName: '이투수' })]))).toBe(
      '!C[!cFFFF00세이브왕!cFFFFFF] 선정!N인천 돌핀즈 이투수!N!N',
    )
  })
})

describe('MVP 발표 창 0x8b23c', () => {
  it('내가 MVP 면 내 팀·이름에 USER_EVT[84] 축하 문구를 붙인다', () => {
    expect(mvpWindowTextOf(시상([칸({ isMine: true, teamId: 4, winnerName: '홍길동' })], true), 나)).toBe(
      '!C[!cFFFF00페넌트레이스 MVP!cFFFFFF]!N!N대구 라이온즈 홍길동!N!N' +
        '축하합니다!!!N[!cFFFF00페넌트레이스 MVP!cFFFFFF]!N로 선정되었습니다.!N',
    )
  })

  it('아니면 내가 못 딴 첫 타이틀 칸의 사람 — 이름이 비었는지는 보지 않는다 (0x8df18)', () => {
    const awards = 시상([
      칸({ isMine: true, teamId: 4, winnerName: '홍길동' }),
      칸({ userEventIndex: 77, teamId: 10, winnerName: '' }),
      칸({ userEventIndex: 78, teamId: 1, winnerName: '김철수' }),
    ])
    expect(mvpWindowTextOf(awards, 나)).toBe('!C[!cFFFF00페넌트레이스 MVP!cFFFFFF]!N!N대한민국 !N!N')
  })

  it('system 3·4 가 아니면 null — 판정을 부르지 않는다', () => {
    let 불림 = 0
    const awardsOf = () => {
      불림 += 1
      return 시상([])
    }
    expect(awardWindowTextOf(0, awardsOf, 나)).toBeNull()
    expect(awardWindowTextOf(1, awardsOf, 나)).toBeNull()
    expect(불림).toBe(0)
    expect(awardWindowTextOf(3, awardsOf, 나)).toBe('!C')
  })
})
