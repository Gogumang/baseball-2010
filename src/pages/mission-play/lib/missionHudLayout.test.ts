import { describe, expect, it } from 'vitest'
import { BATTER_MISSIONS, createProgress } from '@/entities/mission/model/missionGoal'
import { goalTickerFrameAt } from '@/entities/mission/model/goalTicker'
import {
  COUNTER_BASE, COUNTER_CLIP, MISSION_HUD_BASE, TEXT_CLIP,
  goalCountOf, goalLineDrawsOf, limitStripsOf, slashCounterGlyphsOf, timerGlyphsOf,
} from '@/pages/mission-play/lib/missionHudLayout'

const missionNamed = (name: string) => {
  const found = BATTER_MISSIONS.find((mission) => mission.name === name)
  if (found === undefined) throw new Error(name)
  return found
}

describe('타자 미션 HUD 0x36714', () => {
  it('판 12 는 (W − 83 − 6, 6) · "달성" 이미지 17 은 (W − 83 − 1, 0x29) · 방망이 이미지 8 은 (x0 + 7, 8)', () => {
    expect(MISSION_HUD_BASE.map(({ src, left, top }) => ({ src, left, top }))).toEqual([
      { src: './sprites/trainning/frames/012.png', left: 151, top: 6 },
      { src: './sprites/trainning/017.png', left: 156, top: 41 },
      { src: './sprites/trainning/008.png', left: 158, top: 8 },
    ])
  })

  it('목표 줄 — 글 (x0 + 4, 0x19) · "/" (x0 + 0x31, 0x29), 넘기면 글은 −5 · 숫자는 −3 씩 왼쪽으로 가고 다음 줄은 +0x4b · +0x32 옆', () => {
    expect(goalLineDrawsOf(goalTickerFrameAt(0, 2))).toEqual([{ index: 0, textX: 155, textY: 25, counterX: 200, counterY: 41 }])
    // 머무름 21 그림 뒤 둘째 넘김 그림 — 밀림 (5, 3)
    expect(goalLineDrawsOf(goalTickerFrameAt(22, 2))).toEqual([
      { index: 0, textX: 150, textY: 25, counterX: 197, counterY: 41 },
      { index: 1, textX: 225, textY: 25, counterX: 247, counterY: 41 },
    ])
    expect(TEXT_CLIP).toEqual({ x: 158, y: 23, width: 71, height: 14 })
    expect(COUNTER_CLIP).toEqual({ x: 180, y: 39, width: 48, height: 14 })
  })

  it('"지금/목표" — 0x3608c 노랑(0x50): 지금은 "/" 왼쪽 1px 에 오른끝, 목표는 "/" 다음 1px 부터 · "/" 는 이미지 100', () => {
    expect(slashCounterGlyphsOf(1, 2, 200, 41, COUNTER_BASE.yellow)).toEqual([
      { src: './sprites/num/081.png', left: 195, top: 41 },
      { src: './sprites/num/100.png', left: 200, top: 41 },
      { src: './sprites/num/082.png', left: 211, top: 41 },
    ])
    // 흰(0) "/" 는 이미지 101
    expect(slashCounterGlyphsOf(0, 3, 200, 63, COUNTER_BASE.white)[1].src).toBe('./sprites/num/101.png')
  })

  it('0x36358 은 줄 글과 똑같은 이름으로 칸을 고르고 지금을 목표로 자른다 — 그라운드홈런 · 사이클링히트는 칸을 안 읽어 늘 0/1', () => {
    const first = missionNamed('명품 타자의 첫 걸음')
    const progress = { ...createProgress(), counts: { 안타: 5, 타점: 1 } }
    expect(goalCountOf(first, progress, '안타')).toEqual({ current: 2, target: 2 })
    expect(goalCountOf(first, progress, '타점')).toEqual({ current: 1, target: 1 })
    const ground = missionNamed('도전! 그라운드 홈런')
    expect(goalCountOf(ground, { ...createProgress(), counts: { 그라운드홈런: 1 } }, '그라운드홈런')).toEqual({ current: 0, target: 1 })
    const cycle = missionNamed('폭주!! 사이클링 히트')
    expect(goalCountOf(cycle, { ...createProgress(), counts: { 단타: 1, 홈런: 1 } }, '사이클링히트')).toEqual({ current: 0, target: 1 })
  })

  it('타석 띠는 (x0, 59) · "타석" (x0 + 6, 63) · min(쓴 타석 + 1, 한도)/한도 흰 숫자 — 스윙 띠는 그 아래 (x0, 78)', () => {
    const strips = limitStripsOf({ plateAppearanceLimit: 1, plateAppearancesUsed: 1, swingLimit: 3, swingsUsed: 2 })
    expect(strips.map((strip) => [strip.strip.left, strip.strip.top, strip.label.src, strip.label.top])).toEqual([
      [151, 59, './sprites/img_text/frames/262.png', 63],
      [151, 78, './sprites/img_text/frames/264.png', 82],
    ])
    expect(strips[0].strip.opacity).toBe(10 / 16)
    expect(strips[0].glyphs.map((glyph) => glyph.src)).toEqual(['./sprites/num/001.png', './sprites/num/101.png', './sprites/num/001.png'])
    // 스윙은 더하지도 자르지도 않는다
    expect(strips[1].glyphs.map((glyph) => [glyph.src, glyph.top])).toEqual([
      ['./sprites/num/002.png', 82], ['./sprites/num/101.png', 82], ['./sprites/num/003.png', 82],
    ])
  })

  it('타석 한도가 없으면 스윙 띠는 판 바로 아래 (x0, 6 + 51 + 2)', () => {
    const strips = limitStripsOf({ plateAppearanceLimit: 0, plateAppearancesUsed: 0, swingLimit: 3, swingsUsed: 0 })
    expect(strips).toHaveLength(1)
    expect(strips[0].strip.top).toBe(59)
    expect(strips[0].label.top).toBe(63)
  })

  it('시계 0x361e4 — 꺼진 "88" 위에 분 · 초를 두 자리로, 쌍점은 (5 + 0x36, 58 + 5 / 58 + 0xb)', () => {
    const timer = timerGlyphsOf(65)
    const lit = timer.glyphs.filter((glyph) => glyph.color === '#80e6ff')
    expect(lit.map((glyph) => [glyph.src, glyph.left, glyph.top])).toEqual([
      // 분 01 — 정렬 4, 모자란 자리 하나만큼 더 왼쪽: 56 − 7 − 8 = 41
      ['./sprites/num/060.png', 41, 61],
      ['./sprites/num/061.png', 49, 61],
      // 초 05 — 정렬 1, (5 + 0x3b) 부터
      ['./sprites/num/060.png', 64, 61],
      ['./sprites/num/065.png', 72, 61],
    ])
    const unlit = timer.glyphs.filter((glyph) => glyph.color === '#2956a2')
    expect(unlit.map((glyph) => glyph.left)).toEqual([42, 50, 64, 72])
    expect(timer.dots).toEqual([
      { left: 59, top: 63, size: 2, color: '#80e6ff' },
      { left: 59, top: 69, size: 2, color: '#80e6ff' },
    ])
  })
})
