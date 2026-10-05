import { describe, expect, it } from 'vitest'
import { NO_SWING_BOOST, pitcherBoostSideOf, swingBoostOf } from '@/entities/batting/model/swingBoost'
import type { SwingBoostSide } from '@/entities/batting/model/swingBoost'
import { D_LEVEL_RAW } from '@/shared/config/original/dLevel'

/** 보정 구조체 0x34d6c (H2 2절) */

const 없음: SwingBoostSide = { number: 0, isAce: false, isOwnPlayer: false }
const 육성 = (number: number): SwingBoostSide => ({ number, isAce: false, isOwnPlayer: true })
const 마선수 = (aceLevel: number, aceOrder = 0): SwingBoostSide => ({ number: 5 + aceOrder, isAce: true, aceOrder, aceLevel, isOwnPlayer: false })

/** d_level.dat 파일 오프셋에서 s16 · s8 읽기 (적재본 객체 오프셋 − 4) */
const s16 = (fileOffset: number) => {
  const value = D_LEVEL_RAW[fileOffset] | (D_LEVEL_RAW[fileOffset + 1] << 8)
  return value >= 0x8000 ? value - 0x10000 : value
}
const s8 = (fileOffset: number) => (D_LEVEL_RAW[fileOffset] >= 0x80 ? D_LEVEL_RAW[fileOffset] - 0x100 : D_LEVEL_RAW[fileOffset])

describe('타자 쪽 — S+0x10 (이번 스윙의 필살 번호)', () => {
  it('보통 스윙(S+0x10 = 0)이면 0 이다', () => {
    expect(swingBoostOf(없음, 없음)).toEqual(NO_SWING_BOOST)
    expect(swingBoostOf({ ...육성(0) }, 없음)).toEqual(NO_SWING_BOOST)
  })

  it('육성·명전(비트7) 번호 n 은 D[0x7c+2(n−1)] 등 — 히트·파워 150·180·200·220, B 15·17·19·20 %, C 6·7·8·9 %', () => {
    expect([1, 2, 3, 4].map((n) => swingBoostOf(육성(n), 없음))).toEqual([
      { batterHit: 150, batterPower: 150, pitcherVelocity: 0, pitcherControl: 0, solidPercent: 15, homeRunPercent: 6 },
      { batterHit: 180, batterPower: 180, pitcherVelocity: 0, pitcherControl: 0, solidPercent: 17, homeRunPercent: 7 },
      { batterHit: 200, batterPower: 200, pitcherVelocity: 0, pitcherControl: 0, solidPercent: 19, homeRunPercent: 8 },
      { batterHit: 220, batterPower: 220, pitcherVelocity: 0, pitcherControl: 0, solidPercent: 20, homeRunPercent: 9 },
    ])
  })

  it('d_level.dat 바이트와 같다 — 객체 0x7c·0x84·0x19e·0x1a2 = 파일 0x78·0x80·0x19a·0x19e', () => {
    const boost = swingBoostOf(육성(3), 없음)
    expect(boost.batterHit).toBe(s16(0x78 + 4))
    expect(boost.batterPower).toBe(s16(0x80 + 4))
    expect(boost.solidPercent).toBe(s8(0x19a + 2))
    expect(boost.homeRunPercent).toBe(s8(0x19e + 2))
  })

  it('마타자는 번호가 아니라 레벨로 k = 레벨·5 + 순번 — Lv1·Lv2 150/15/6 … Lv5 220/20/9, 다섯 명 같다', () => {
    expect([0, 1, 2, 3, 4].map((level) => swingBoostOf(마선수(level), 없음).batterHit)).toEqual([150, 150, 180, 200, 220])
    expect([0, 1, 2, 3, 4].map((level) => swingBoostOf(마선수(level), 없음).solidPercent)).toEqual([15, 15, 17, 19, 20])
    expect([0, 1, 2, 3, 4].map((level) => swingBoostOf(마선수(level), 없음).homeRunPercent)).toEqual([6, 6, 7, 8, 9])
    for (const order of [0, 1, 2, 3, 4]) {
      expect(swingBoostOf(마선수(3, order), 없음)).toEqual(swingBoostOf(마선수(3, 0), 없음))
    }
    // 객체 0x100 + 2k = 파일 0xfc + 2k (k = 3·5 + 2 = 17)
    expect(swingBoostOf(마선수(3, 2), 없음).batterPower).toBe(s16(0x12e + 34))
    expect(swingBoostOf(마선수(3, 2), 없음).homeRunPercent).toBe(s8(0x1bb + 17))
  })

  it('번호가 있어도 마선수도 비트7 도 아니면 0 (일반 CPU 선수 — 실제로는 +0x18 이 모두 0)', () => {
    expect(swingBoostOf({ number: 2, isAce: false, isOwnPlayer: false }, 없음)).toEqual(NO_SWING_BOOST)
  })
})

describe('투수 쪽 — P+0x10 (공에 실린 마구 번호)', () => {
  it('육성·명전 마구 n — 구속·제구 150~220, % 는 10·12·14·15 / 7·8·9·10', () => {
    expect(swingBoostOf(없음, 육성(4))).toEqual({
      batterHit: 0,
      batterPower: 0,
      pitcherVelocity: 220,
      pitcherControl: 220,
      solidPercent: 15,
      homeRunPercent: 10,
    })
    // 객체 0x94(구속 out+4)·0x8c(제구 out+6) = 파일 0x90·0x88
    expect(swingBoostOf(없음, 육성(2)).pitcherVelocity).toBe(s16(0x90 + 2))
    expect(swingBoostOf(없음, 육성(2)).pitcherControl).toBe(s16(0x88 + 2))
  })

  it('마투수 레벨 표 — 객체 0xce(out+4)·0x9c(out+6)·0x16c·0x185', () => {
    expect([0, 1, 2, 3, 4].map((level) => swingBoostOf(없음, 마선수(level)).pitcherVelocity)).toEqual([150, 150, 180, 200, 220])
    expect([0, 1, 2, 3, 4].map((level) => swingBoostOf(없음, 마선수(level)).solidPercent)).toEqual([10, 10, 12, 14, 15])
    expect([0, 1, 2, 3, 4].map((level) => swingBoostOf(없음, 마선수(level)).homeRunPercent)).toEqual([7, 7, 8, 9, 10])
  })

  it('필살과 마구가 겹치면 % 칸(+0xa·+0xb)은 투수 값이 덮어쓴다 — 히트·파워는 그대로 (0x34ff0)', () => {
    expect(swingBoostOf(육성(4), 육성(1))).toEqual({
      batterHit: 220,
      batterPower: 220,
      pitcherVelocity: 150,
      pitcherControl: 150,
      solidPercent: 10,
      homeRunPercent: 7,
    })
  })

  it('공에 번호가 남았는데 투수가 마선수도 비트7 도 아니면 타자 % 가 남는다', () => {
    expect(swingBoostOf(육성(4), { number: 3, isAce: false, isOwnPlayer: false }).solidPercent).toBe(20)
  })
})

describe('pitcherBoostSideOf — 투수 +0x18 로 갈래 고르기', () => {
  const 레벨 = () => 3
  it('5~9 는 마투수 (순번 = 번호 − 5), 1~4 는 비트7, 0 은 일반', () => {
    expect(pitcherBoostSideOf(7, 7, 레벨)).toEqual({ number: 7, isAce: true, aceOrder: 2, aceLevel: 3, isOwnPlayer: false })
    expect(pitcherBoostSideOf(2, 2, 레벨)).toEqual({ number: 2, isAce: false, aceOrder: 0, aceLevel: 0, isOwnPlayer: true })
    expect(pitcherBoostSideOf(0, 0, 레벨)).toEqual({ number: 0, isAce: false, aceOrder: 0, aceLevel: 0, isOwnPlayer: false })
  })
})
