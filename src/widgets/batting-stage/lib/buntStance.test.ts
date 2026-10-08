import { describe, expect, it } from 'vitest'
import { buntStanceAfterBuntKey, buntStanceAfterSwingKey, isBuntJudgeFrame, sceneBuntKindAfterKey, sceneBuntKindOnPitch } from '@/widgets/batting-stage/lib/buntStance'

describe('번트 판정 시점 — 0x4e060 의 r7 (S+8 && 틱 == N−1)', () => {
  it('공이 N−1 틱에 닿을 때 판정한다 (그 전은 아니다)', () => {
    expect(isBuntJudgeFrame(16, 18)).toBe(false)
    expect(isBuntJudgeFrame(17, 18)).toBe(true)
  })
})

describe('번트 자세에서 스윙 키 — 0xb9374 가 S+8 이면 스윙을 안 낸다', () => {
  it('번트 종류는 그대로, 판정 F(+0xfd8)만 누른 틱으로', () => {
    expect(buntStanceAfterSwingKey({ kind: 2, frame: 4 }, 11)).toEqual({ kind: 2, frame: 11 })
  })
})

describe('번트 키 0x6a7 → 0x51e48 — 마선수 타자(0xb633c)면 예약하지 않는다', () => {
  it('없으면 세우고(+0xfe0 = 1 · +0xfdc = 종류 · +0xfd8 = 틱), 있으면 지운다', () => {
    expect(buntStanceAfterBuntKey(null, 3, 7, false)).toEqual({ kind: 3, frame: 7 })
    expect(buntStanceAfterBuntKey({ kind: 3, frame: 7 }, 1, 9, false)).toBeNull()
  })

  it('마선수 타자면 아무것도 안 바뀐다 (51e66~51e7a)', () => {
    expect(buntStanceAfterBuntKey(null, 2, 7, true)).toBeNull()
  })
})

describe('사람 키가 쓰는 장면 +0xfdc — 0x51dce · 0x51e2c · 0x51e84', () => {
  it('스윙 · 필살 키는 0, 번트 키는 그 종류 — 번트 자세에서 스윙 키를 눌러도 0 이 된다', () => {
    expect(sceneBuntKindAfterKey(2, { kind: '스윙' })).toBe(0)
    expect(sceneBuntKindAfterKey(3, { kind: '필살' })).toBe(0)
    expect(sceneBuntKindAfterKey(0, { kind: '번트', buntKind: 2, isAceBatter: false })).toBe(2)
  })

  it('마선수는 번트 키를 무시한다(0xb633c) — 앞 값이 남는다', () => {
    expect(sceneBuntKindAfterKey(1, { kind: '번트', buntKind: 3, isAceBatter: true })).toBe(1)
  })
})

describe('0x11 진입 0x3de10 의 memset(+0xfd8, 0, 12) — 장면 +0xfdc 는 공마다 0 에서 시작한다 (3deb8 0x340dc)', () => {
  const 첫공 = { id: 1 }
  const 둘째공 = { id: 2 }

  it('새 공이면 지난 공의 번트 종류를 지운다 — 키 없는 공은 0', () => {
    expect(sceneBuntKindOnPitch({ pitch: 첫공, kind: 2 }, 둘째공)).toEqual({ pitch: 둘째공, kind: 0 })
  })

  it('같은 공 안에서는 키가 쓴 값이 남는다', () => {
    const memory = { pitch: 첫공, kind: 3 }
    expect(sceneBuntKindOnPitch(memory, 첫공)).toBe(memory)
  })

  it('공이 없으면(견제 — 0x11 을 안 지난다) 지우지 않는다', () => {
    const memory = { pitch: 첫공, kind: 1 }
    expect(sceneBuntKindOnPitch(memory, null)).toBe(memory)
  })
})
