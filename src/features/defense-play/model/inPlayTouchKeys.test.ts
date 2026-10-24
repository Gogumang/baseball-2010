import { describe, expect, it } from 'vitest'
import { inPlayCommandOf } from '@/entities/defense-controls/model/defenseKeys'
import { DEFENSE_THROW_OFFERS, inPlayTouchOffersOf, OFFENSE_RUNNER_OFFERS } from '@/features/defense-play/model/inPlayTouchKeys'

describe('수비 인플레이 터치 상황 버튼 — 원본 키 표 그대로', () => {
  it('수비: 1루 · 2루 · 3루 · 홈 송구', () => {
    expect(DEFENSE_THROW_OFFERS.map((offer) => [offer.label, inPlayCommandOf(offer.key, '수비')])).toEqual([
      ['1루 송구', { kind: '송구', target: 1 }],
      ['2루 송구', { kind: '송구', target: 2 }],
      ['3루 송구', { kind: '송구', target: 3 }],
      ['홈 송구', { kind: '송구', target: 0 }],
    ])
  })

  it('공격: 진루 1 · 2 · 3 · 전원, 슬라이딩(OK), 귀루 1 · 2 · 3 · 전원(CLR) — 확인 · 뒤로 버튼 없이도 닿는다', () => {
    expect(OFFENSE_RUNNER_OFFERS.map((offer) => [offer.label, inPlayCommandOf(offer.key, '공격')])).toEqual([
      ['1루주자 진루', { kind: '진루', runner: 1 }],
      ['2루주자 진루', { kind: '진루', runner: 2 }],
      ['3루주자 진루', { kind: '진루', runner: 3 }],
      ['전원 진루', { kind: '진루', runner: '전원' }],
      ['슬라이딩', { kind: '슬라이딩' }],
      ['1루주자 귀루', { kind: '귀루', runner: 1 }],
      ['2루주자 귀루', { kind: '귀루', runner: 2 }],
      ['3루주자 귀루', { kind: '귀루', runner: 3 }],
      ['전원 귀루', { kind: '귀루', runner: '전원' }],
    ])
    expect(OFFENSE_RUNNER_OFFERS.map((offer) => offer.key)).toContain('Enter')
    expect(OFFENSE_RUNNER_OFFERS.map((offer) => offer.key)).toContain('Escape')
  })

  it('자동 판(쪽 없음)은 버튼이 없다 · 차례는 order 로 선다', () => {
    expect(inPlayTouchOffersOf(undefined)).toEqual([])
    expect(inPlayTouchOffersOf('수비').map((offer) => offer.order)).toEqual([0, 1, 2, 3])
  })
})
