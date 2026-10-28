import { describe, expect, it } from 'vitest'
import {
  aceOrderOfMagicNumber,
  advanceMagicPitchGameState,
  createMagicPitchGameState,
  isAceMagicNumber,
  FRESH_HELD_CPU_MAGIC,
  UNFILLED_MAGIC_REMAINING,
  cpuMagicStateOf,
  heldCpuMagicAfterPitch,
  heldCpuMagicAfterPitcherChange,
  magicCountOfPitcherAbility,
} from '@/entities/pitching/model/magicPitchGame'
import type { PitcherAbility } from '@/entities/pitching/model/pitch'
import { MAGIC_PITCH_TYPE_NUMBER } from '@/entities/pitcher-career/model/magicPitch'
import { ACE_PITCHER_REPERTOIRES, ROSTER_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'

const FASTBALL = 1

describe('magicPitchGame — 한 경기 마구 상태 (0xaebe4 · 0x345fc · 0x3de10)', () => {
  it('마투수 레코드 +0x18 은 5~9 다 (H2 4-1)', () => {
    expect(ACE_PITCHER_REPERTOIRES.map((ace) => ace.magicId)).toEqual([5, 6, 7, 8, 9])
    expect(ACE_PITCHER_REPERTOIRES.every((ace) => isAceMagicNumber(ace.magicId))).toBe(true)
    expect(isAceMagicNumber(4)).toBe(false)
  })

  it('일반 투수는 +0x18 이 0 이라 남은 횟수가 0 이다', () => {
    const state = createMagicPitchGameState(ROSTER_PITCHER_REPERTOIRES[0])
    expect(ROSTER_PITCHER_REPERTOIRES.every((pitcher) => pitcher.magicId === 0)).toBe(true)
    expect(state).toEqual({ remaining: 0, ballMagicNumber: 0 })
  })

  it('마투수 Lv1 은 표 0xd8509 의 3 회로 시작한다', () => {
    expect(createMagicPitchGameState(ACE_PITCHER_REPERTOIRES[0]).remaining).toBe(3)
    expect(createMagicPitchGameState(ACE_PITCHER_REPERTOIRES[0], { aceLevel: 4 }).remaining).toBe(7)
    expect(createMagicPitchGameState(ACE_PITCHER_REPERTOIRES[0], { hasSpiritSkill: true }).remaining).toBe(5)
  })

  it('마투수 순번 = 마구 번호 − 5 (0xb63a1, H2 4-1) — 레벨 칸 mgr[0x13a + 순번]', () => {
    expect(ACE_PITCHER_REPERTOIRES.map((ace) => aceOrderOfMagicNumber(ace.magicId))).toEqual([0, 1, 2, 3, 4])
    expect(aceOrderOfMagicNumber(0)).toBe(-1)
    expect(aceOrderOfMagicNumber(4)).toBe(-1)
  })

  it('레벨별 마구 횟수는 0xd8509 = [3, 4, 5, 6, 7]', () => {
    expect([0, 1, 2, 3, 4].map((aceLevel) => createMagicPitchGameState(ACE_PITCHER_REPERTOIRES[2], { aceLevel }).remaining)).toEqual([3, 4, 5, 6, 7])
  })

  it('첫 마구는 공짜다 — 소모 조건이 `공+0x10 != 0` 인 원본 버그 그대로', () => {
    const state = { remaining: 3, ballMagicNumber: 0 }
    advanceMagicPitchGameState(state, MAGIC_PITCH_TYPE_NUMBER, 5)
    expect(state).toEqual({ remaining: 3, ballMagicNumber: 5 })
    advanceMagicPitchGameState(state, MAGIC_PITCH_TYPE_NUMBER, 5)
    expect(state).toEqual({ remaining: 2, ballMagicNumber: 5 })
  })

  it('홈런더비(모드 7)는 소모가 없다 — 0x345fc 가 0x34644 에서 0x348d6 으로 끝나 0x34894 를 안 지난다', () => {
    const state = { remaining: 3, ballMagicNumber: 0 }
    for (let index = 0; index < 10; index += 1) advanceMagicPitchGameState(state, MAGIC_PITCH_TYPE_NUMBER, 6, true)
    expect(state).toEqual({ remaining: 3, ballMagicNumber: 6 })
  })

  it('마구가 아닌 공에도 공+0x10 이 남는다 — 되돌리는 코드가 원본에 없다 (H2 3-4)', () => {
    const state = { remaining: 3, ballMagicNumber: 0 }
    advanceMagicPitchGameState(state, MAGIC_PITCH_TYPE_NUMBER, 5)
    advanceMagicPitchGameState(state, FASTBALL, 5)
    expect(state.ballMagicNumber).toBe(5)
    expect(state.remaining).toBe(3)
  })

  it('마지막 한 번(남은 1→0)은 공+0x10 을 새로 쓰지 않는다 (0x3de10 의 `남은 > 0`)', () => {
    const state = { remaining: 1, ballMagicNumber: 9 }
    advanceMagicPitchGameState(state, MAGIC_PITCH_TYPE_NUMBER, 9)
    // 소모로 0 이 되어 싣기 가지를 못 타지만, 직전 값이 남아 마구 보정은 그대로 붙는다
    expect(state).toEqual({ remaining: 0, ballMagicNumber: 9 })
  })

  it('한 경기에 나가는 마구는 표 값 + 1 이다', () => {
    const state = createMagicPitchGameState(ACE_PITCHER_REPERTOIRES[0])
    let thrown = 0
    while (state.remaining > 0) {
      advanceMagicPitchGameState(state, MAGIC_PITCH_TYPE_NUMBER, 5)
      thrown += 1
    }
    expect(thrown).toBe(3 + 1)
  })
})

describe('진행기가 드는 CPU 마구 두 칸 — 팀+0x28 (−1 = 안 채움) · 공+0x10 (0xaebe4 aeea8 · aec7a)', () => {
  const 마투수 = (magicId: number, skillBits = 0): PitcherAbility => ({
    control: 60,
    velocity: 60,
    repertoire: { form: 0, pitchMask: 0, magicId },
    skillBits,
  })

  it('안 채웠으면 지금 마운드 투수로 채운다 — 마투수는 0xd8509[레벨], 일반은 0xd84ff[번호], 혼신(비트 23) +2', () => {
    expect(FRESH_HELD_CPU_MAGIC).toEqual({ remaining: UNFILLED_MAGIC_REMAINING, ballMagicNumber: 0 })
    // 순번 0(번호 5) — 레벨 칸 mgr[0x13a] 이 2 면 표 [3,4,5,6,7] 의 5
    expect(magicCountOfPitcherAbility(마투수(5), { 0: 2 })).toBe(5)
    expect(magicCountOfPitcherAbility(마투수(2), undefined)).toBe(5)
    expect(magicCountOfPitcherAbility(마투수(2, 1 << 23), undefined)).toBe(7)
    expect(magicCountOfPitcherAbility(마투수(0), undefined)).toBe(0)
    expect(cpuMagicStateOf(FRESH_HELD_CPU_MAGIC, 마투수(5), undefined)).toEqual({ remaining: 3, ballMagicNumber: 0 })
  })

  it('한 번 찬 뒤로는 다시 차지 않는다 — 같은 투수가 서 있는 동안 경기 내내 이어진다 (aeea8 → aeeae bge)', () => {
    const pitcher = 마투수(5)
    let held = FRESH_HELD_CPU_MAGIC
    // 첫 마구는 공+0x10 이 0 이라 공짜(0x345fc 원본 버그), 둘째부터 준다
    held = heldCpuMagicAfterPitch(held, pitcher, undefined, MAGIC_PITCH_TYPE_NUMBER)
    expect(held).toEqual({ remaining: 3, ballMagicNumber: 5 })
    held = heldCpuMagicAfterPitch(held, pitcher, undefined, MAGIC_PITCH_TYPE_NUMBER)
    expect(held).toEqual({ remaining: 2, ballMagicNumber: 5 })
    // 직구에도 공+0x10 은 남는다 — 되돌리는 코드가 없다
    held = heldCpuMagicAfterPitch(held, pitcher, undefined, FASTBALL)
    expect(cpuMagicStateOf(held, pitcher, undefined)).toEqual({ remaining: 2, ballMagicNumber: 5 })
  })

  it('투수 교체는 +0x28 만 −1 로 비운다 — 공 +0x10 은 경기에 하나라 그대로 (aec7a)', () => {
    const held = { remaining: 1, ballMagicNumber: 6 }
    expect(heldCpuMagicAfterPitcherChange(held)).toEqual({ remaining: UNFILLED_MAGIC_REMAINING, ballMagicNumber: 6 })
    expect(cpuMagicStateOf(heldCpuMagicAfterPitcherChange(held), 마투수(5), undefined)).toEqual({
      remaining: 3,
      ballMagicNumber: 6,
    })
  })
})
