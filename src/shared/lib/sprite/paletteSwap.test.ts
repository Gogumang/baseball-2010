import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
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

/** 8비트 RGBA · 비비월 PNG 만 읽는다 (`tools/apply_mpl.py` · `decode_pzx.py` 가 PIL 로 쓴 꼴) */
function readRgbaPng(path: string): { readonly width: number; readonly height: number; readonly data: Uint8ClampedArray } {
  const file = readFileSync(path)
  let at = 8
  let width = 0
  let height = 0
  const chunks: Buffer[] = []
  while (at < file.length) {
    const length = file.readUInt32BE(at)
    const type = file.toString('latin1', at + 4, at + 8)
    const body = file.subarray(at + 8, at + 8 + length)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      if (body[8] !== 8 || body[9] !== 6 || body[12] !== 0) throw new Error(`RGBA 8비트 비비월이 아니다: ${path}`)
    } else if (type === 'IDAT') chunks.push(body)
    at += 12 + length
  }
  const raw = inflateSync(Buffer.concat(chunks))
  const stride = width * 4
  const data = new Uint8ClampedArray(stride * height)
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (stride + 1)]
    for (let x = 0; x < stride; x += 1) {
      const value = raw[y * (stride + 1) + 1 + x]
      const left = x >= 4 ? data[y * stride + x - 4] : 0
      const up = y > 0 ? data[(y - 1) * stride + x] : 0
      const upLeft = x >= 4 && y > 0 ? data[(y - 1) * stride + x - 4] : 0
      let predictor = 0
      if (filter === 1) predictor = left
      else if (filter === 2) predictor = up
      else if (filter === 3) predictor = (left + up) >> 1
      else if (filter === 4) {
        const estimate = left + up - upLeft
        const toLeft = Math.abs(estimate - left)
        const toUp = Math.abs(estimate - up)
        const toUpLeft = Math.abs(estimate - upLeft)
        predictor = toLeft <= toUp && toLeft <= toUpLeft ? left : toUp <= toUpLeft ? up : upLeft
      }
      data[y * stride + x] = (value + predictor) & 0xff
    }
  }
  return { width, height, data }
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

  it('시간대 하늘 구름·조명은 런타임에 칠하므로 프레임마다 번호 지도가 있다 (0x76ff6 · 0x7703e)', () => {
    for (const folder of ['attack_sky_cloud', 'sky_effect_light']) {
      const frames = readdirSync(`public/sprites/${folder}/frames`).filter((name) => /^\d{3}\.png$/.test(name))
      expect(frames.length).toBeGreaterThan(0)
      for (const name of frames) expect(existsSync(`public/sprites/${folder}/frames/index/${name}`)).toBe(true)
    }
    expect(loadPalettes('attack_sky_cloud').palettes).toHaveLength(8)
    expect(loadPalettes('sky_effect_light').palettes).toHaveLength(6)
  })

  /**
   * 반투명 파트(0x66 · 0x67)가 아래 없이 놓인 자리도 번호를 남긴다 (r134). 원본 그리기 0xc9f98 은 그 효과를
   * 픽셀 효과 1 · 2 (표 0xda988) 로 넘기고, 팔레트판 0x97769 · 0x973c5 는 둘 다 인자 팔레트[번호]로 색을 얻는다 —
   * mpl 로 갈아 끼운 팔레트가 조명·그림자에도 먹는다. 기본 팔레트로 칠하면 구운 PNG 와 바이트가 같아야 한다.
   */
  it('반투명 파트 지도: 기본 팔레트로 칠하면 구운 그림 그대로다 (0xc9f98 → 0x97769 · 0x973c5)', () => {
    let kept = 0
    for (const folder of ['sky_effect_light', 'defender', 'event_char_0']) {
      const colors = loadPalettes(folder).colors
      const frames = readdirSync(`public/sprites/${folder}/frames/index`).filter((name) => /^\d{3}\.png$/.test(name))
      for (const name of frames) {
        const baked = readRgbaPng(`public/sprites/${folder}/frames/${name}`)
        const index = readRgbaPng(`public/sprites/${folder}/frames/index/${name}`)
        expect(index.width).toBe(baked.width)
        expect(index.height).toBe(baked.height)
        expect(Array.from(recolorPixels(baked.data, index.data, colors))).toEqual(Array.from(baked.data))
        for (let at = 3; at < index.data.length; at += 4) if (index.data[at] !== 0 && baked.data[at] !== 255) kept += 1
      }
    }
    // 반투명 자리에 번호가 남았다 (sky_effect_light 11장 × 4405 · defender 그림자 · event_char_0 볼터치)
    expect(kept).toBeGreaterThan(11 * 4405)
  })

  it('하늘 조명(sky_effect_light, 효과 0x67)은 번호 지도가 비어 있지 않다 — 시간대 팔레트가 먹는다 (0x7703e)', () => {
    const index = readRgbaPng('public/sprites/sky_effect_light/frames/index/000.png')
    let numbered = 0
    for (let at = 3; at < index.data.length; at += 4) if (index.data[at] !== 0) numbered += 1
    expect(numbered).toBe(4405)
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
