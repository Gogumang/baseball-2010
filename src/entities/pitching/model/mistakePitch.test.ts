import { describe, expect, it } from 'vitest'
import { isMistakePitch, mistakePercentOf } from '@/entities/pitching/model/mistakePitch'
import type { MistakePitchInput } from '@/entities/pitching/model/mistakePitch'
import type { RandomPort } from '@/shared/api/random/randomPort'

const 보통: MistakePitchInput = {
  isMagicPitch: false,
  grade: 3,
  effectiveControl: 500,
  runnerCount: 0,
  hasSecondBaseRunner: false,
  batterIntimidates: false,
  pitcherIsSteady: false,
  pitcherIsTimid: false,
  pitcherIsCool: false,
}

function 각본(value: number): RandomPort & { readonly used: () => number } {
  let used = 0
  return {
    next: () => {
      used += 1
      return value
    },
    nextInRange: () => 0,
    pick: <T,>(c: readonly T[]) => c[0],
    used: () => used,
  }
}

describe('실투 확률 p — 원본 0x33cbc', () => {
  it('p = 8 − 등급(c × 표0xd2589[t] / 100) + 표0xd257d[t]', () => {
    // t=3: 500 × 100% = 500 → 등급 3 → 8 − 3 + 0 = 5
    expect(mistakePercentOf(보통)).toBe(5)
    // t=1: 500 × 80% = 400 → 등급 3 → 8 − 3 + 5 = 10
    expect(mistakePercentOf({ ...보통, grade: 1 })).toBe(10)
    // t=5: 999 × 110% = 1098 → 등급 7 → 8 − 7 − 2 = −1 → 1 로 바닥
    expect(mistakePercentOf({ ...보통, grade: 5, effectiveControl: 999 })).toBe(1)
  })

  it('등급 경계는 이하 비교다 — 125 는 0, 126 은 1 (0xbbe98)', () => {
    expect(mistakePercentOf({ ...보통, effectiveControl: 125 })).toBe(8)
    expect(mistakePercentOf({ ...보통, effectiveControl: 126 })).toBe(7)
  })

  it('게이지를 안 누르면(t = 0) 제구와 무관하게 20', () => {
    expect(mistakePercentOf({ ...보통, grade: 0, effectiveControl: 999 })).toBe(20)
    expect(mistakePercentOf({ ...보통, grade: 0, effectiveControl: 0 })).toBe(20)
  })

  it('스킬 — 압도 +5 · 안정감(주자 2명↑) −5 · 새가슴(2루 주자) +10 · 냉정 −10', () => {
    expect(mistakePercentOf({ ...보통, batterIntimidates: true })).toBe(10)
    expect(mistakePercentOf({ ...보통, pitcherIsSteady: true, runnerCount: 1 })).toBe(5)
    expect(mistakePercentOf({ ...보통, pitcherIsSteady: true, runnerCount: 2 })).toBe(0)
    expect(mistakePercentOf({ ...보통, pitcherIsTimid: true })).toBe(5)
    expect(mistakePercentOf({ ...보통, pitcherIsTimid: true, hasSecondBaseRunner: true })).toBe(15)
    // 5 − 10 → 0 으로 바닥 (원본 max(p−10, 0))
    expect(mistakePercentOf({ ...보통, pitcherIsCool: true })).toBe(0)
  })
})

describe('isMistakePitch — 굴림', () => {
  it('p > rand(0,100) 이면 실투다', () => {
    // p = 5: 4 는 실투, 5 는 아님
    expect(isMistakePitch(보통, 각본(0.04))).toBe(true)
    expect(isMistakePitch(보통, 각본(0.05))).toBe(false)
  })

  it('마구는 굴리지도 않고 실투가 아니다', () => {
    const random = 각본(0)
    expect(isMistakePitch({ ...보통, isMagicPitch: true }, random)).toBe(false)
    expect(random.used()).toBe(0)
  })

  it('마구가 아니면 늘 한 번 굴린다 — p 가 0 이어도', () => {
    const random = 각본(0)
    expect(isMistakePitch({ ...보통, pitcherIsCool: true }, random)).toBe(false)
    expect(random.used()).toBe(1)
  })
})
