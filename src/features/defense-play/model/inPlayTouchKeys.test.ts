import { describe, expect, it } from 'vitest'
import { inPlayCommandOf } from '@/entities/defense-controls/model/defenseKeys'
import { DEFENSE_THROW_OFFERS, inPlayTouchOffersOf, OFFENSE_RUNNER_OFFERS, offenseOffersFor } from '@/features/defense-play/model/inPlayTouchKeys'
import { basePosition } from '@/entities/fielding/model/fieldGeometry'
import { createRunner, type RunnerState } from '@/entities/fielding/model/fieldingState'

/** +0x8c = from 에서 +0x7c = to 로 가는 중인 주자 */
const running = (index: number, from: number, to: number): RunnerState => {
  const a = basePosition(from)
  const b = basePosition(to)
  return {
    ...createRunner(index, from, 335, { isBatterRunner: index === 0 }),
    targetBase: to,
    position: { x: Math.trunc((a.x + b.x) / 2), y: 0, z: Math.trunc((a.z + b.z) / 2) },
  }
}
const labelsOf = (runners: readonly RunnerState[], homeRunFlag = false) =>
  offenseOffersFor({ runners, homeRunFlag }).map((offer) => offer.label)

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

describe('공격 쪽은 그 순간 먹는 키만 (0xa9b04 — 주자 +0x8c · 귀루 검사 0xa99a8 · +0x111)', () => {
  it('타자 주자만 달리면(+0x8c = 0) 루 주자 키 · 전원 키는 아무 일이 없다 — 슬라이딩만', () => {
    expect(labelsOf([running(0, 0, 1)])).toEqual(['슬라이딩'])
  })

  it('1루 주자가 2루로 달리면 1루주자 진루 · 귀루와 전원 진루 · 귀루 — 빈 루 키는 없다', () => {
    expect(labelsOf([running(0, 0, 1), running(1, 1, 2)])).toEqual([
      '1루주자 진루', '전원 진루', '슬라이딩', '1루주자 귀루', '전원 귀루',
    ])
  })

  it('1루로 가는 주자(+0x7c ≤ 1)는 못 되돌린다 — 귀루 버튼이 없다', () => {
    const batterOnFirst = { ...createRunner(0, 1, 335, { isBatterRunner: true }) }
    expect(labelsOf([batterOnFirst])).toEqual(['1루주자 진루', '전원 진루', '슬라이딩'])
  })

  it('홈런(+0x111)이면 진루 · 귀루가 모두 아무 일이 없다', () => {
    expect(labelsOf([running(0, 0, 1), running(1, 1, 2)], true)).toEqual(['슬라이딩'])
  })

  it('주자 형편을 안 주면 아홉 다', () => {
    expect(inPlayTouchOffersOf('공격')).toBe(OFFENSE_RUNNER_OFFERS)
    expect(inPlayTouchOffersOf('공격', { runners: [] })).toEqual([])
  })
})
