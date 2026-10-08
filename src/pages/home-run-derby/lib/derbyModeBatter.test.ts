import { describe, expect, it } from 'vitest'
import { derbyHallOfFameBatterIndexOf } from '@/pages/home-run-derby/lib/derbyModeBatter'

describe('홈런더비 모드 타자 게터 0x1fc20', () => {
  it('대기가 없으면 고른 대로 — 명전 번호(+0xa6 ≥ 0)면 명예 타자, 나리 칸(−1)이면 나리 타자편 저장', () => {
    expect(derbyHallOfFameBatterIndexOf({ side: '타자', hallOfFameIndex: 2 }, false)).toBe(2)
    expect(derbyHallOfFameBatterIndexOf({ side: '타자', hallOfFameIndex: null }, false)).toBeNull()
  })

  it('타자편 대결 대기 g[0x11f] 가 서 있으면 명예 타자를 골랐어도 나리 타자편 저장 선수 (1fc3c)', () => {
    expect(derbyHallOfFameBatterIndexOf({ side: '타자', hallOfFameIndex: 2 }, true)).toBeNull()
    expect(derbyHallOfFameBatterIndexOf({ side: '타자', hallOfFameIndex: null }, true)).toBeNull()
  })
})
