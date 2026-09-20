import { describe, expect, it } from 'vitest'
import {
  BURST_RESULT_BIT as B,
  HUMAN_WIN_END_BITS,
  burstResultBitsOf,
  hasBit,
} from '@/entities/burst-mission/model/burstResultBits'

const 단타 = { kind: '안타', bases: 1 } as const
const 이루타 = { kind: '안타', bases: 2 } as const
const 삼루타 = { kind: '안타', bases: 3 } as const
const 홈런 = { kind: '홈런' } as const
const 볼넷 = { kind: '볼넷' } as const
const 삼진 = { kind: '삼진' } as const
const 땅볼아웃 = { kind: '아웃', detail: '땅볼아웃' } as const

describe('결과비트 값 (타석 결과 +0x188)', () => {
  it('12개 비트가 0x1 부터 0x800 까지다', () => {
    expect(Object.values(B)).toEqual([
      0x001, 0x002, 0x004, 0x008, 0x010, 0x020, 0x040, 0x080, 0x100, 0x200, 0x400, 0x800,
    ])
    expect(HUMAN_WIN_END_BITS).toBe(0x801)
  })
})

describe('타석 결과 → 결과비트', () => {
  it('진루 수에 따라 홈런·2루타·3루타·단타 비트가 하나만 켜진다 (0xa87b6)', () => {
    const 기본 = { runsBattedIn: 0, outsBefore: 0, outsAdded: 0 }

    expect(hasBit(burstResultBitsOf({ ...기본, outcome: 홈런 }), B.홈런)).toBe(true)
    expect(hasBit(burstResultBitsOf({ ...기본, outcome: 이루타 }), B['2루타'])).toBe(true)
    expect(hasBit(burstResultBitsOf({ ...기본, outcome: 삼루타 }), B['3루타'])).toBe(true)
    expect(hasBit(burstResultBitsOf({ ...기본, outcome: 단타 }), B.단타)).toBe(true)
    expect(hasBit(burstResultBitsOf({ ...기본, outcome: 이루타 }), B.단타)).toBe(false)
  })

  it('점수가 들어오면 B4(타점)가 켜진다 (0xa89c4)', () => {
    const bits = burstResultBitsOf({ outcome: 이루타, runsBattedIn: 2, outsBefore: 0, outsAdded: 0 })

    expect(hasBit(bits, B.타점)).toBe(true)
  })

  it('B5 는 출루이고 이닝이 안 끝났을 때만 켜진다 (0xa882a)', () => {
    const 살아남음 = burstResultBitsOf({ outcome: 볼넷, runsBattedIn: 0, outsBefore: 1, outsAdded: 0 })
    const 이닝끝 = burstResultBitsOf({ outcome: 단타, runsBattedIn: 0, outsBefore: 2, outsAdded: 1 })

    expect(hasBit(살아남음, B.출루)).toBe(true)
    expect(hasBit(이닝끝, B.출루)).toBe(false)
  })

  it('야수선택처럼 타자주자만 살면 안타가 아니어도 B5 가 켜진다', () => {
    const bits = burstResultBitsOf({
      outcome: 땅볼아웃,
      runsBattedIn: 0,
      outsBefore: 0,
      outsAdded: 1,
      batterRunnerSafe: true,
    })

    expect(hasBit(bits, B.출루)).toBe(true)
    expect(hasBit(bits, B.아웃)).toBe(true)
  })

  it('B6 은 번트로 주자가 나가거나 점수가 났을 때다 (0xa88f8)', () => {
    const 희생번트 = burstResultBitsOf({
      outcome: 땅볼아웃,
      runsBattedIn: 0,
      outsBefore: 0,
      outsAdded: 1,
      isBunt: true,
      runnersAdvanced: true,
    })
    const 헛번트 = burstResultBitsOf({
      outcome: 땅볼아웃,
      runsBattedIn: 0,
      outsBefore: 0,
      outsAdded: 1,
      isBunt: true,
    })

    expect(hasBit(희생번트, B.번트진루)).toBe(true)
    expect(hasBit(헛번트, B.번트진루)).toBe(false)
  })

  it('B7 은 번트 뒤 2·3루에 주자가 남고 이닝이 안 끝났을 때다 (0xa87ac)', () => {
    const 공통 = {
      outcome: 땅볼아웃,
      runsBattedIn: 0,
      outsBefore: 0,
      outsAdded: 1,
      isBunt: true,
      runnerInScoringPositionAfter: true,
    } as const

    expect(hasBit(burstResultBitsOf(공통), B.번트득점권)).toBe(true)
    expect(hasBit(burstResultBitsOf({ ...공통, inningEnded: true }), B.번트득점권)).toBe(false)
  })

  it('아웃 하나면 B8, 한 플레이에 둘이면 B10 까지 켜진다 (0xa8e44·0xa8e54)', () => {
    const 하나 = burstResultBitsOf({ outcome: 땅볼아웃, runsBattedIn: 0, outsBefore: 0, outsAdded: 1 })
    const 병살 = burstResultBitsOf({ outcome: 땅볼아웃, runsBattedIn: 0, outsBefore: 0, outsAdded: 2 })

    expect(hasBit(하나, B.아웃)).toBe(true)
    expect(hasBit(하나, B.병살)).toBe(false)
    expect(hasBit(병살, B.아웃 | B.병살)).toBe(true)
  })

  it('삼진은 B9 와 B8 이 함께, 볼넷은 B11 이 켜진다', () => {
    const 삼진비트 = burstResultBitsOf({ outcome: 삼진, runsBattedIn: 0, outsBefore: 0, outsAdded: 1 })
    const 볼넷비트 = burstResultBitsOf({ outcome: 볼넷, runsBattedIn: 0, outsBefore: 0, outsAdded: 0 })

    expect(hasBit(삼진비트, B.삼진)).toBe(true)
    expect(hasBit(삼진비트, B.아웃)).toBe(true)
    expect(hasBit(볼넷비트, B.볼넷)).toBe(true)
  })

  it('⚠️ 원본 그대로 — 사람 팀 승리로 끝난 플레이는 홈런·볼넷 비트를 덤으로 켠다 (0xa89f0)', () => {
    const bits = burstResultBitsOf({
      outcome: 땅볼아웃,
      runsBattedIn: 1,
      outsBefore: 0,
      outsAdded: 1,
      humanTeamWalkOff: true,
    })

    expect(hasBit(bits, B.홈런)).toBe(true)
    expect(hasBit(bits, B.볼넷)).toBe(true)
  })
})
