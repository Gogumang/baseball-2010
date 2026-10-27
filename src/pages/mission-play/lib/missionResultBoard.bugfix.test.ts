import { afterEach, describe, expect, it } from 'vitest'
import { ORIGINAL_BUGFIX_CONFIG, bugfixConfigWith, setBugfixConfigForTests } from '@/shared/config/bugfixes'
import { missionResultLeaveOf, missionResultStepOf } from './missionResultBoard'

afterEach(() => setBugfixConfigForTests(ORIGINAL_BUGFIX_CONFIG))

describe('B-106 미션 마선수 대결 결과 판 OK (0x407f0 408ce~408f2)', () => {
  const 타자대결 = { flag11f: true, flag176: false }
  const 투수대결 = { flag11f: false, flag176: true }
  const 보통 = { flag11f: false, flag176: false }

  it('원본 — 한 칸만 서면 OK 는 다시 · 목록', () => {
    expect(missionResultStepOf('확인', true, 타자대결).exit).toBe('다시')
    expect(missionResultStepOf('확인', false, 투수대결).exit).toBe('목록')
  })

  it('고친 길 — CLR 처럼 한 칸만 서도 OK 는 대결 끝, 보통 미션은 그대로', () => {
    setBugfixConfigForTests(bugfixConfigWith(['B-106']))
    expect(missionResultStepOf('확인', true, 타자대결).exit).toBe('대결끝')
    expect(missionResultStepOf('확인', false, 투수대결).exit).toBe('대결끝')
    expect(missionResultStepOf('확인', true, { flag11f: true, flag176: true }).exit).toBe('대결끝')
    expect(missionResultStepOf('확인', true, 보통).exit).toBe('다시')
    expect(missionResultStepOf('확인', false, 보통).exit).toBe('목록')
    expect(missionResultLeaveOf(missionResultStepOf('확인', true, 타자대결).exit ?? '목록', true)).toBe('떠나기')
  })
})
