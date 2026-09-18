import { describe, expect, it } from 'vitest'
import { describeOutcomeBanner } from '@/entities/at-bat/model/resolutionText'

describe('describeOutcomeBanner — 원본 기록달성 이름 (StrGAME)', () => {
  it('홈런은 누상 주자 수에 따라 솔로·2점·3점·만루 홈런이다 ([9]~[12])', () => {
    expect([0, 1, 2, 3].map((runners) => describeOutcomeBanner({ kind: '홈런' }, runners))).toEqual([
      '솔로 홈런',
      '2점 홈런',
      '3점 홈런',
      '만루 홈런',
    ])
  })

  it('3루타는 원본 이름 그대로다 ([8])', () => {
    expect(describeOutcomeBanner({ kind: '안타', bases: 3 }, 0)).toBe('3루타')
  })

  it('그 밖의 결과는 기존 문구다', () => {
    expect(describeOutcomeBanner({ kind: '안타', bases: 1 }, 0)).toBe('안타!')
    expect(describeOutcomeBanner({ kind: '삼진' }, 2)).toBe('삼진…')
  })
})
