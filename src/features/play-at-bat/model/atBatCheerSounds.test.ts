import { describe, expect, it } from 'vitest'
import { inPlayCallSoundIdOf, walkCheerSoundIdOf, WALK_CHEER_SOUND } from '@/features/play-at-bat/model/atBatSounds'
import { outcomeOfPattern } from '@/entities/batting/model/battedBallOutcome'
import { createSeededRandom } from '@/shared/api/random/seededRandom'

/**
 * 이번에 새로 이은 두 갈래만 본다 — **볼넷 뒤 함성 29**(0x51afa~0x51b02) 와
 * **판정 v11 = 2스트라이크 번트 파울 아웃의 아웃 콜 62**(0x51b20).
 * 나머지 번호 규칙은 `atBatSounds.test.ts` 가 들고 있다.
 */

describe('볼넷 뒤 관중 함성 29 (0x51b02)', () => {
  it('공격 팀이 CPU 조작이면 볼넷 뒤에 29 를 낸다 — state[0x31 + state[9]] == 1', () => {
    expect(walkCheerSoundIdOf({ kind: '볼넷' }, true)).toBe(WALK_CHEER_SOUND)
    expect(WALK_CHEER_SOUND).toBe(29)
  })

  it('사람이 볼넷을 골랐으면 안 낸다 — 0x51aee 의 `cmp r3,#1` 이 안 맞는다', () => {
    expect(walkCheerSoundIdOf({ kind: '볼넷' }, false)).toBeNull()
  })

  it('볼넷이 아니면 CPU 타석이어도 안 낸다 — v3 갈래 안에만 있는 꼬리다', () => {
    expect(walkCheerSoundIdOf({ kind: '삼진' }, true)).toBeNull()
    expect(walkCheerSoundIdOf({ kind: '안타', bases: 1 }, true)).toBeNull()
    expect(walkCheerSoundIdOf(null, true)).toBeNull()
  })
})

describe('판정 v11 — 2스트라이크 번트 파울 아웃의 아웃 콜 (0x51b20)', () => {
  /** 각이 페어 범위(45~135) 밖이라 반드시 파울이 되는 패턴 */
  const 파울패턴 = [20, 600, 300, 0] as const

  it('2스트라이크 번트 파울은 `isBuntFoulOut` 을 단 아웃이 된다 (0x9d5e2~0x9d600)', () => {
    const result = outcomeOfPattern(0, 파울패턴, createSeededRandom(1), { strikes: 2, buntKind: 1 })
    expect(result.kind).toBe('타구')
    if (result.kind !== '타구') return
    expect(result.outcome).toEqual({ kind: '아웃', detail: '직선타아웃' })
    expect(result.isBuntFoulOut).toBe(true)
  })

  it('1스트라이크거나 번트가 아니면 그냥 파울이다 — 표가 안 붙는다', () => {
    expect(outcomeOfPattern(0, 파울패턴, createSeededRandom(1), { strikes: 1, buntKind: 1 }).kind).toBe('파울')
    expect(outcomeOfPattern(0, 파울패턴, createSeededRandom(1), { strikes: 2, buntKind: 0 }).kind).toBe('파울')
  })

  it('그 표가 서면 수비 결과를 보지 않고 62 다 — 원본 v11 은 조건이 없다', () => {
    const 아웃 = { kind: '아웃', detail: '직선타아웃' } as const
    // 수비 진행기가 "못 잡았고 태그도 아니다" 라고 해도 62 다
    expect(inPlayCallSoundIdOf(아웃, { caughtOnTheFly: false, tagOut: false, buntFoulOut: true })).toBe(62)
    // 표가 없으면 예전대로 v13 갈래(state[0x1f]·state[0x87])를 본다
    expect(inPlayCallSoundIdOf(아웃, { caughtOnTheFly: false, tagOut: false })).toBe(20)
  })
})
