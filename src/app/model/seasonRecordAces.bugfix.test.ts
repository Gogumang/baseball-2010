import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { seasonRecordAcesAfterGame } from '@/app/model/useSeasonSession'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 지난날 = { 3: { pitcher: 1, batter: -1 } }
const 오늘 = { 0: { pitcher: 2, batter: 4 }, 5: { pitcher: -1, batter: 0 } }

describe('B-72 경기 뒤 팀 레코드에 남는 마선수', () => {
  it('원본: 0xdf · 0xe5 전까지 지난 날 것과 오늘 넣은 것이 모두 남는다', () => {
    expect(seasonRecordAcesAfterGame(지난날, 오늘)).toEqual({ ...지난날, ...오늘 })
  })

  it('고침: 경기 끝에 곧장 뺀다(0xb512c × 열 팀)', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-72']))
    expect(seasonRecordAcesAfterGame(지난날, 오늘)).toEqual({})
  })
})
