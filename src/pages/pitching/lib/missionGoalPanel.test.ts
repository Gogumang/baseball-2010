import { describe, expect, it } from 'vitest'
import { counterImagesOf, GOAL_TEXT, missionPanelImagesOf, PANEL_X } from '@/pages/pitching/lib/missionGoalPanel'

describe('미션 HUD 판 0x36714', () => {
  it('판 프레임 12 를 (W − 83 − 6, 6) · "달성" 이미지 17 을 (156, 41) · 공 아이콘 7 을 (158, 7) 에', () => {
    expect(PANEL_X).toBe(151)
    const images = missionPanelImagesOf({ mode: 5, plateAppearance: null, pitches: null })
    expect(images).toEqual([
      { src: './sprites/trainning/frames/012.png', left: 151, top: 6 },
      { src: './sprites/trainning/017.png', left: 156, top: 41 },
      { src: './sprites/trainning/007.png', left: 158, top: 7 },
    ])
  })

  it('목표 글은 x0 + (83 − 0x4b)/2 = 155 에서 폭 0x4b 가운데, 넘기는 동안 (158, 23, 71, 14) 로 자른다', () => {
    expect(GOAL_TEXT).toEqual({ x: 155, y: 25, width: 75, clip: { x: 158, y: 23, width: 71, height: 14 } })
  })

  it('투구 제한 줄 — 타석 줄이 없으면 판 아래 (151, 59), 있으면 그 아래 (151, 78)', () => {
    const onlyPitches = missionPanelImagesOf({ mode: 5, plateAppearance: null, pitches: { limit: 9, thrown: 3 } })
    expect(onlyPitches[3]).toEqual({ src: './sprites/trainning/frames/013.png', left: 151, top: 59 })
    expect(onlyPitches[4]).toEqual({ src: './sprites/img_text/263.png', left: 157, top: 63 })
    const both = missionPanelImagesOf({ mode: 5, plateAppearance: { limit: 3, used: 3 }, pitches: { limit: 9, thrown: 3 } })
    expect(both[3]).toEqual({ src: './sprites/trainning/frames/013.png', left: 151, top: 59 })
    expect(both[4]).toEqual({ src: './sprites/img_text/262.png', left: 157, top: 63 })
    // 타석 줄 "min(쓴 + 1, 제한) / 제한" = 3 / 3
    expect(both.slice(5, 8).map((image) => image.src)).toEqual(['./sprites/num/003.png', './sprites/num/101.png', './sprites/num/003.png'])
    expect(both[8]).toEqual({ src: './sprites/trainning/frames/013.png', left: 151, top: 78 })
  })

  it('0x3608c — "/" 왼쪽 1px 에 a 오른끝, "/" 다음 1px 부터 b', () => {
    expect(counterImagesOf(2, 10, 200, 63)).toEqual([
      { src: './sprites/num/002.png', left: 191, top: 63 },
      { src: './sprites/num/101.png', left: 200, top: 63 },
      { src: './sprites/num/001.png', left: 211, top: 63 },
      { src: './sprites/num/000.png', left: 216, top: 63 },
    ])
  })
})
