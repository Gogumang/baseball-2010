import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { judgeModeReset, MODE_RESET_TEXT } from '@/entities/settings/model/modeReset'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

const 막힘 = { isSeasonGameInProgress: true, isCareerPlayerInSeasonTeam: true }

describe('B-62 투수편 초기화 막기 글', () => {
  it('원본: 투수편은 [213] "삭제 하실 수 없습니다"', () => {
    expect(judgeModeReset('career-pitcher', 막힘).blockText).toBe(MODE_RESET_TEXT.blockedDelete)
    expect(MODE_RESET_TEXT.blockedDelete).toContain('삭제')
  })

  it('고침: 투수편도 타자편과 같은 [212] "초기화 하실 수 없습니다"', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-62']))
    expect(judgeModeReset('career-pitcher', 막힘).blockText).toBe(MODE_RESET_TEXT.blockedReset)
    expect(judgeModeReset('career-batter', 막힘).blockText).toBe(MODE_RESET_TEXT.blockedReset)
  })
})
