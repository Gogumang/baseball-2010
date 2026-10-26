import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { gpItemNoticeOf } from '@/entities/career/model/gpItems'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

describe('B-45 나리 GP 능력치 아이템 알림 숫자', () => {
  it('원본: 실제 +10 인데 칸별 6 · 모든능력치 8 로 찍힌다', () => {
    expect(gpItemNoticeOf(1, null)).toBe('파워 6  !c00CC00상승!cFFFFFF하였습니다')
    expect(gpItemNoticeOf(4, null)).toBe('모든능력치 8  !c00CC00상승!cFFFFFF하였습니다')
  })

  it('고침: 실제 상승 10 을 쓴다 — 다른 아이템 글은 그대로', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-45']))
    expect(gpItemNoticeOf(1, null)).toBe('파워 10  !c00CC00상승!cFFFFFF하였습니다')
    expect(gpItemNoticeOf(4, null)).toBe('모든능력치 10  !c00CC00상승!cFFFFFF하였습니다')
    expect(gpItemNoticeOf(6, null)).toBe('!C!cFFFF00사기 +40!cFFFFFF 회복되었습니다 ')
  })
})
