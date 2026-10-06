import { describe, expect, it } from 'vitest'
import type { RandomPort } from '@/shared/api/random/randomPort'
import {
  NO_NARI_ACE, batterMatchInfoOf, nariMatchCancelTargetOf, rollNariMatchAces,
} from '@/pages/management/lib/nariMatchPrepare'
import { createCareer } from '@/entities/career/model/playerCareer'

/** next() 가 차례로 이 값들을 내는 난수 — 부른 횟수와 구간을 적는다 */
const 차례난수 = (values: readonly number[]) => {
  const calls: [number, number][] = []
  let index = 0
  const next = () => values[index++] ?? 0
  const random: RandomPort = {
    next,
    nextInRange: (minimum, maximum) => {
      calls.push([minimum, maximum])
      return minimum + next() * (maximum - minimum)
    },
    pick: (candidates) => candidates[0],
  }
  return { random, calls }
}

describe('142 진입 0x1c46c 의 마선수 굴림 넷 (1c60c · 1c61a · 1c640 · 1c656)', () => {
  it('내 마타자(0x9f604) → 내 마투수(0x9f650) → 상대 마투수(0x66968) → 상대 마타자(0x66994) 차례다', () => {
    const { random, calls } = 차례난수([0.5, 0.9, 0.1, 0.3])
    const aces = rollNariMatchAces(random, { pitcherIds: [0, 2, 4], batterIds: [1, 3] })
    // 마타자 [1,3] 에서 bfa55(0,2) → 1 → 3 · 마투수 [0,2,4] 에서 bfa55(0,3) → 2 → 4
    expect(aces.myBatter).toBe(3)
    expect(aces.myPitcher).toBe(4)
    // 상대 마투수 bfa55(0,5) → 0 (내 4 와 다르다) · 상대 마타자 → 1
    expect(aces.opponentPitcher).toBe(0)
    expect(aces.opponentBatter).toBe(1)
    expect(calls).toEqual([[0, 2], [0, 3], [0, 5], [0, 5]])
  })

  it('열린 마선수가 없어도 bfa55(0, 0) 을 불러 난수를 쓰고 −1 이다 — 상대는 ldrb 라 −1 과 안 겹친다', () => {
    const { random, calls } = 차례난수([0.7, 0.7, 0.0, 0.99])
    const aces = rollNariMatchAces(random, { pitcherIds: [], batterIds: [] })
    expect(aces).toEqual({ myBatter: NO_NARI_ACE, myPitcher: NO_NARI_ACE, opponentPitcher: 0, opponentBatter: 4 })
    expect(calls).toEqual([[0, 0], [0, 0], [0, 5], [0, 5]])
  })

  it('상대 마선수가 내 번호와 겹치면 하나 내린다(0 이면 4) — 0x6697c~0x66988', () => {
    const { random } = 차례난수([0, 0, 0, 0])
    const aces = rollNariMatchAces(random, { pitcherIds: [0], batterIds: [0] })
    expect(aces).toMatchObject({ myBatter: 0, myPitcher: 0, opponentPitcher: 4, opponentBatter: 4 })
  })
})

describe('142 취소 0x13c72 — 135 / 128 / 109', () => {
  it('국가대항전 → 135, 포스트시즌 → 128, 그 밖 → 109', () => {
    expect(nariMatchCancelTargetOf({ isNationalCup: true, isPostseason: true })).toBe('국가대항전')
    expect(nariMatchCancelTargetOf({ isNationalCup: false, isPostseason: true })).toBe('포스트시즌')
    expect(nariMatchCancelTargetOf({ isNationalCup: false, isPostseason: false })).toBe('다음경기순위')
  })
})

describe('142 경기정보 다섯 줄 (0x5dcc0 모드 2~4 갈래)', () => {
  it('순위·승패는 나리 리그, 마선수 줄은 굴린 번호 — 안 굴렸으면 "-"', () => {
    const career = createCareer('준비')
    const 없음 = batterMatchInfoOf(career, null)
    expect(없음.lines.map((line) => line.label)).toEqual(['순위', '승패', '선발', '마투수', '마타자'])
    expect(없음.lines[1]).toMatchObject({ user: '0승0패', cpu: '0승0패' })
    expect(없음.lines[3]).toMatchObject({ user: '-', cpu: '-' })
    const 있음 = batterMatchInfoOf(career, { myBatter: 0, myPitcher: 0, opponentPitcher: 1, opponentBatter: 2 })
    expect(있음.lines[3].user).not.toBe('-')
    expect(있음.lines[4].cpu).not.toBe('-')
    expect(있음.myTeamId).toBe(career.teamId)
  })
})
