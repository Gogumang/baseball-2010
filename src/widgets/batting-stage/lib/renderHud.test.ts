import { describe, expect, it } from 'vitest'
import { INITIAL_LAMP_ZOOM, alignedNumberGlyphsOf, hudRowsOf, lampCountOf, roundFillRectsOf, stepLampZoom, type HudState, type LampZoomMemory } from '@/widgets/batting-stage/lib/renderHud'

const HUD: HudState = {
  inning: 1,
  half: '초',
  ourScore: 3,
  opponentScore: 5,
  balls: 0,
  strikes: 0,
  outs: 0,
  bases: { first: false, second: false, third: false },
  ourLogoUrl: 'ours.png',
  opponentLogoUrl: 'theirs.png',
}

describe('hudRowsOf — 위 줄 = 측 0(선공), 아래 줄 = 측 1 (0x373d0 37516~37548 · 375e8~37620)', () => {
  it('사람 팀이 선공(측 0)이면 위 줄이 사람 팀이다', () => {
    const rows = hudRowsOf({ ...HUD, playerSide: 0 })
    expect(rows.top).toEqual({ logoUrl: 'ours.png', score: 3, isBatting: true })
    expect(rows.bottom).toEqual({ logoUrl: 'theirs.png', score: 5, isBatting: false })
  })

  it('사람 팀이 후공(측 1)이면 위 줄이 상대다 — 말 공격이면 아래 줄 막대', () => {
    const rows = hudRowsOf({ ...HUD, half: '말', playerSide: 1 })
    expect(rows.top).toEqual({ logoUrl: 'theirs.png', score: 5, isBatting: false })
    expect(rows.bottom).toEqual({ logoUrl: 'ours.png', score: 3, isBatting: true })
  })

  it('측을 안 주면 사람 = 후공으로 본다', () => {
    expect(hudRowsOf(HUD).top.logoUrl).toBe('theirs.png')
  })
})

describe('lampCountOf — 램프 칸 수를 자른다 (0x376a4~0x376d0)', () => {
  it('스트라이크·아웃은 2, 볼은 3 까지만 켠다', () => {
    expect(lampCountOf({ max: 2 }, 3)).toBe(2)
    expect(lampCountOf({ max: 3 }, 4)).toBe(3)
    expect(lampCountOf({ max: 2 }, 1)).toBe(1)
    expect(lampCountOf({ max: 3 }, 0)).toBe(0)
  })
})

describe('stepLampZoom — 새 램프 확대 (0x37730~0x37892)', () => {
  const run = (counts: readonly number[], ticks: readonly number[], start: LampZoomMemory = INITIAL_LAMP_ZOOM) => {
    let memory = start
    return counts.map((count, index) => {
      memory = stepLampZoom(memory, count, ticks[index] ?? index)
      return memory.zoom
    })
  }

  it('칸 수가 바뀌면 5·4·3·2·1 배로 다섯 그림 동안 줄인다', () => {
    expect(run([1, 1, 1, 1, 1, 1, 1], [0, 1, 2, 3, 4, 5, 6])).toEqual([5, 4, 3, 2, 1, 0, 0])
  })

  it('같은 틱에 두 번 그려도 한 그림으로 센다', () => {
    expect(run([1, 1, 1], [0, 0, 1])).toEqual([5, 5, 4])
  })

  it('칸 0 이면 지난 칸 수를 안 바꾼다 — 1 → 0 → 1 은 확대가 없다(원본 그대로)', () => {
    expect(run([1, 1, 1, 1, 1, 0, 1, 2], [0, 1, 2, 3, 4, 5, 6, 7])).toEqual([5, 4, 3, 2, 1, 0, 0, 5])
  })

  it('칸 0 인 동안은 타이머도 줄지 않는다', () => {
    expect(run([1, 0, 0, 1], [0, 1, 2, 3])).toEqual([5, 0, 0, 4])
  })

  it('틱이 거꾸로 가면(타석 시작 0xd 진입 0x48f08) 타이머만 지운다 — 지난 칸 수는 남는다', () => {
    expect(run([1, 1, 2], [10, 0, 1])).toEqual([5, 0, 5])
  })
})

describe('alignedNumberGlyphsOf — HUD 점수 0xba719 → 0xba51c', () => {
  // num.pzx 020~029: "1" 은 4×10, 나머지는 6×10
  const sizeOf = (index: number) => ({ width: index === 21 ? 4 : 6, height: 10 })
  const options = (align: number) => ({ spacing: 1, start: 20, align, offsetX: -3, offsetY: 0 })

  it('위 줄 (박스 = 줄 상자 x + 3, 정렬 0x24): x = 줄x + 36 − Σ(폭 + 1), y = 줄y + 2', () => {
    expect(alignedNumberGlyphsOf(3, { x: 11, y: 21, width: 36, height: 14 }, options(0x24), sizeOf))
      .toEqual([{ index: 23, x: 37, y: 23 }])
    expect(alignedNumberGlyphsOf(10, { x: 11, y: 21, width: 36, height: 14 }, options(0x24), sizeOf))
      .toEqual([{ index: 21, x: 32, y: 23 }, { index: 20, x: 37, y: 23 }])
  })

  it('아래 줄 (박스 y + 3, 정렬 4): 세로 맞춤 없이 y = 41', () => {
    expect(alignedNumberGlyphsOf(12, { x: 11, y: 41, width: 36, height: 14 }, options(0x4), sizeOf))
      .toEqual([{ index: 21, x: 32, y: 41 }, { index: 22, x: 37, y: 41 }])
  })

  it('세로 가운데는 나머지를 아래로 — (h − 최대높이) 홀수면 올림, 글자는 아래 맞춤', () => {
    const tall = (index: number) => ({ width: 6, height: index === 21 ? 9 : 10 })
    expect(alignedNumberGlyphsOf(12, { x: 0, y: 0, width: 20, height: 15 }, { ...options(0x20), offsetX: 0 }, tall))
      .toEqual([{ index: 21, x: 0, y: 4 }, { index: 22, x: 7, y: 3 }])
  })

  it('그림이 아직 없으면 null', () => {
    expect(alignedNumberGlyphsOf(1, { x: 0, y: 0, width: 1, height: 1 }, options(0), () => null)).toBeNull()
  })
})

describe('roundFillRectsOf — HUD 둥근 칠 0xba0bd → 0x6b7d4', () => {
  const cellsOf = (rects: readonly { x: number; y: number; width: number; height: number }[]) => {
    const cells = new Set<string>()
    for (const rect of rects) {
      for (let x = rect.x; x < rect.x + rect.width; x += 1) {
        for (let y = rect.y; y < rect.y + rect.height; y += 1) cells.add(`${x},${y}`)
      }
    }
    return cells
  }

  it('판 검정 (5,5,82,50) 둥글기 5 는 83×51 을 덮고 모서리마다 ㄱ자 세 칸을 비운다', () => {
    const cells = cellsOf(roundFillRectsOf({ x: 5, y: 5, width: 82, height: 50 }, 5))
    expect(cells.size).toBe(83 * 51 - 4 * 3)
    for (const missing of ['5,5', '6,5', '5,6', '87,55', '86,55', '87,54']) expect(cells.has(missing)).toBe(false)
    expect(cells.has('87,7')).toBe(true)
  })

  it('팀 줄 둥글기 3 은 모서리 한 칸씩만 비운다', () => {
    const cells = cellsOf(roundFillRectsOf({ x: 8, y: 21, width: 36, height: 14 }, 3))
    expect(cells.size).toBe(37 * 15 - 4)
    expect(['8,21', '44,21', '8,35', '44,35'].some((cell) => cells.has(cell))).toBe(false)
  })
})
