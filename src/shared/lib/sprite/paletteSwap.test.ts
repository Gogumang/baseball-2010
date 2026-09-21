import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  TEAM_COUNT,
  indexMapUrl,
  outfitPaletteIndex,
  paletteUrl,
  parseHexColor,
  portraitPaletteIndex,
  recolorPixels,
  type SpritePalettes,
} from '@/shared/lib/sprite/paletteSwap'
import { frameBoxesOf, type FrameBoxes } from '@/shared/lib/sprite/useFrameOrigins'

function loadPalettes(folder: string): SpritePalettes {
  return JSON.parse(readFileSync(`public/sprites/${folder}/palette.json`, 'utf8')) as SpritePalettes
}

describe('팔레트 번호', () => {
  it('몸통은 피부 × 15 + 팀 이다 (0x78be8)', () => {
    expect(outfitPaletteIndex(0, 0)).toBe(0)
    expect(outfitPaletteIndex(0, 2)).toBe(2)
    expect(outfitPaletteIndex(1, 0)).toBe(15)
    expect(outfitPaletteIndex(2, 14)).toBe(44)
    expect(TEAM_COUNT).toBe(15)
  })

  it('이벤트 초상화는 피부 1 → 0 · 2 → 1 · 0 → 없음 이다 (0x63a7e)', () => {
    expect(portraitPaletteIndex(0)).toBeNull()
    expect(portraitPaletteIndex(1)).toBe(0)
    expect(portraitPaletteIndex(2)).toBe(1)
  })
})

describe('색 바꾸기', () => {
  it('#rrggbb 를 읽는다', () => {
    expect(parseHexColor('#ffba9c')).toEqual([255, 186, 156])
    expect(parseHexColor('엉터리')).toEqual([0, 0, 0])
  })

  it('번호 지도가 가리키는 색으로 바꾸고, 알파 0 인 자리는 그대로 둔다', () => {
    // 픽셀 두 개: 0번은 팔레트 1 로 바꾸고, 1번은 지도 알파가 0 이라 손대지 않는다
    const color = new Uint8ClampedArray([10, 20, 30, 255, 40, 50, 60, 255])
    const index = new Uint8ClampedArray([1, 0, 0, 255, 2, 0, 0, 0])
    const painted = recolorPixels(color, index, ['#000000', '#ff0011', '#00ff00'])
    expect([...painted]).toEqual([255, 0, 17, 255, 40, 50, 60, 255])
  })

  it('원본 배열을 건드리지 않는다', () => {
    const color = new Uint8ClampedArray([10, 20, 30, 255])
    recolorPixels(color, new Uint8ClampedArray([1, 0, 0, 255]), ['#000000', '#ffffff'])
    expect([...color]).toEqual([10, 20, 30, 255])
  })
})

describe('짝이 되는 파일 경로', () => {
  it('번호 지도는 같은 이름으로 index/ 아래 있다', () => {
    expect(indexMapUrl('./sprites/pitcher/frames/003.png')).toBe('./sprites/pitcher/frames/index/003.png')
    expect(indexMapUrl('./sprites/pitcher/003.png')).toBe('./sprites/pitcher/index/003.png')
  })

  it('palette.json 은 frames 위 폴더에 있다', () => {
    expect(paletteUrl('./sprites/pitcher/frames/003.png')).toBe('./sprites/pitcher/palette.json')
    expect(paletteUrl('./sprites/pitcher/003.png')).toBe('./sprites/pitcher/palette.json')
  })
})

describe('구워 둔 원본 데이터', () => {
  it('몸통 팔레트는 45벌이고 구워진 벌은 팀 2 · 황인이다', () => {
    const balancer = loadPalettes('batter_balancer')
    expect(balancer.palettes).toHaveLength(45)
    expect(balancer.baked).toBe(2)
    // 팀만 다른 벌은 살색이 같다 (C-1: 팀은 허리띠·양말만 바꾼다)
    expect(balancer.palettes[0][3]).toBe(balancer.palettes[14][3])
    // 피부가 바뀌면 살색이 바뀐다 — 황인 #de9a8c · 백인 #ffd7c6 · 흑인 #94695a (C-1 표)
    expect(balancer.palettes[outfitPaletteIndex(0, 0)][3]).toBe('#de9a8c')
    expect(balancer.palettes[outfitPaletteIndex(1, 0)][3]).toBe('#ffd7c6')
    expect(balancer.palettes[outfitPaletteIndex(2, 0)][3]).toBe('#94695a')
  })

  it('투수는 45벌인데 구워진 벌이 0(팀 0) 이다 — 타자와 다르다', () => {
    expect(loadPalettes('pitcher').baked).toBe(0)
  })

  it('헬멧·수비수는 팀만 있어 15벌이다', () => {
    expect(loadPalettes('batter_helmet').palettes).toHaveLength(15)
    expect(loadPalettes('defender').palettes).toHaveLength(15)
  })
})

describe('프레임 박스 (C-10)', () => {
  it('mode_ui 프레임 2 는 등록·관리 화면 기본정보 카드의 상자다', () => {
    const boxes = JSON.parse(
      readFileSync('public/sprites/mode_ui/frames/boxes.json', 'utf8'),
    ) as FrameBoxes
    // C-create-palette.md C-6 의 표와 같은 숫자여야 한다
    expect(frameBoxesOf(boxes, 2)).toEqual([
      [21, 176, 196, 83],
      [30, 184, 25, 15],
      [60, 184, 81, 15],
      [147, 184, 25, 15],
      [176, 184, 32, 15],
    ])
    expect(frameBoxesOf(boxes, 0)).toEqual([
      [11, 53, 93, 117],
      [122, 48, 107, 84],
    ])
    expect(frameBoxesOf(boxes, 9999)).toEqual([])
  })
})
