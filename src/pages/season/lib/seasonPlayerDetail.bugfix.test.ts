import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { seasonPlayerDetailViewOf } from '@/pages/season/lib/seasonPlayerDetail'
import type { SeasonPlayerDetailContext } from '@/pages/season/lib/seasonPlayerDetail'
import type { SeasonPlayerRecordView } from '@/entities/season-mode/model/seasonPlayerRecord'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 타자: SeasonPlayerRecordView = {
  name: '시험타자',
  isPitcher: false,
  base: [500, 500, 500, 500],
  profile: 0,
  skillBits: 0,
  equipment: [0, 0, 0, 0],
  fieldPosition: 3,
  isComplete: true,
}
/** 앓고 있는데(SR+5 = 1) 입원 여유 SR+6 이 0 */
const 앓음여유0: SeasonPlayerDetailContext = { record: { illness: 1, illnessSlack: 0, coach: -1, teamId: 0 }, teamMorale: 100 }

describe('B-80 질병 줄은 SR+5, 실제 −30% 는 SR+6 을 본다', () => {
  it('원본: 줄은 뜨는데 변화 칸에 −30% 가 없다', () => {
    const view = seasonPlayerDetailViewOf(타자, 앓음여유0)
    expect(view.messages).toEqual(['[!cFFFF00질병!cFFFFFF] 모든능력치 30% 감소'])
    expect(view.rows[0]?.change).toBe(0)
  })

  it('고침: −30% 도 SR+5 를 봐 줄과 맞는다 — 안 앓으면 여유 칸이 남아도 안 깎인다', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-80']))
    expect(seasonPlayerDetailViewOf(타자, 앓음여유0).rows[0]?.change).toBe(-150)
    const 건강 = seasonPlayerDetailViewOf(타자, { ...앓음여유0, record: { illness: 0, illnessSlack: 3, coach: -1, teamId: 0 } })
    expect(건강.messages).toEqual([])
    expect(건강.rows[0]?.change).toBe(0)
  })
})
