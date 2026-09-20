import { describe, expect, it } from 'vitest'
import { aceMatchMissionOf, aceMatchPitcherOf, matchResultEventOf, mergeStoryCarry } from '@/entities/story/model/aceMatch'

describe('마선수 대결 — r_event match 명령', () => {
  it('team 16~20 은 마투수 싸이커·레오니·붕붕머신·발렌타인·드래고나다 (StrCOMMON[15~19])', () => {
    expect([16, 17, 18, 19, 20].map((team) => aceMatchPitcherOf(team)?.name)).toEqual([
      '싸이커', '레오니', '붕붕머신', '발렌타인', '드래고나',
    ])
    expect(aceMatchPitcherOf(3)).toBeNull()
  })

  it('대결 레코드는 미션 번호 = team − 1 이다 (0x8d764, S13 4-1 확정)', () => {
    const mission = aceMatchMissionOf(18)

    expect(mission).toMatchObject({ side: '타자', stage: 0, name: '붕붕머신', opponentAce: 3 })
    expect(aceMatchMissionOf(99)).toBeNull()
    // 번호는 "공략" 레코드에만 쓰이는 것이 아니다 — 표의 아무 레코드나 그대로 가리킨다
    expect(aceMatchMissionOf(1)).toMatchObject({ side: '타자', id: 1, name: '명품 타자의 첫 걸음' })
    // 편은 이벤트 쪽(evt+0x20)이 정한다 — 투수편이면 투수 미션 표를 본다
    expect(aceMatchMissionOf(16, '투수')).toMatchObject({ side: '투수', id: 16, name: '메디카' })
  })

  it('이기면 첫 결과 이벤트, 지면 둘째 결과 이벤트로 간다', () => {
    expect(matchResultEventOf([114, 115], true)).toBe(114)
    expect(matchResultEventOf([114, 115], false)).toBe(115)
  })

  it('결과 이벤트가 끝나면 대결 전 이벤트의 보상·기록까지 함께 넘긴다', () => {
    const carried = { rewards: [{ kind: 0, value: 3 }], viewedEventIds: [112] }
    const cursors = new Map([
      ['114:0', [{ kind: 10, value: 500 }]],
      ['114:2', []],
    ])

    expect(mergeStoryCarry(carried, cursors)).toEqual({
      rewards: [{ kind: 0, value: 3 }, { kind: 10, value: 500 }],
      viewedEventIds: [112, 114],
    })
  })
})
