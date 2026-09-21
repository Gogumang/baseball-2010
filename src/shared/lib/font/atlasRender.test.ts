import { describe, expect, it } from 'vitest'
import { readFileSync, writeFileSync } from 'node:fs'
import { deflateSync, inflateSync } from 'node:zlib'
import { ASCII_ATLAS, HANGUL_ATLAS } from '@/shared/lib/font/atlas'
import { layoutPixelText } from '@/shared/lib/font/layout'

/**
 * 아틀라스 PNG + 배치 + 조각 고르기를 한 줄로 이어 실제 점을 찍어 본다.
 *
 * 여기서 나오는 그림은 해독 문서가 원본 함수를 unicorn 으로 돌려 만든 참조 그림
 * (스크래치패드 work/R5/hangul.png) 과 **픽셀 단위로 같다**는 것을 눈으로 대조해 확인했다.
 * 그 그림의 지문을 박아 두어, 셋 중 하나라도 어긋나면 걸리게 한다.
 *
 * 눈으로 다시 보고 싶으면:
 *   PIXEL_FONT_PNG=/tmp/pixel-font-web-sample.png yarn vitest run src/shared/lib/font/atlasRender.test.ts
 */

const SAMPLE = [
  '게임빌 2010 프로야구',
  '홈런! 삼진 아웃, 뷁 괜찮아?',
  'ㄱㄴㄷ ㅏㅑ 한글 조합형 벌 글꼴',
  'Score 3:2 (9th) HOMERUN~',
  '쏀 괩 닒 가각갂 꽃밭 읽다 넓다',
].join('\n')

/** 우리가 내는 아틀라스는 RGBA·필터 0 뿐이라 알파만 뽑으면 된다 */
function readAtlasAlpha(path: string) {
  const raw = readFileSync(path)
  const width = raw.readUInt32BE(16)
  const height = raw.readUInt32BE(20)
  const parts: Buffer[] = []
  let position = 8
  while (position < raw.length) {
    const length = raw.readUInt32BE(position)
    if (raw.subarray(position + 4, position + 8).toString() === 'IDAT') {
      parts.push(raw.subarray(position + 8, position + 8 + length))
    }
    position += 12 + length
  }
  const plain = inflateSync(Buffer.concat(parts))
  const stride = width * 4
  const rows: number[][] = []
  for (let y = 0; y < height; y += 1) {
    const row: number[] = []
    for (let x = 0; x < width; x += 1) row.push(plain[y * (stride + 1) + 1 + x * 4 + 3])
    rows.push(row)
  }
  return { width, height, rows }
}

function crc32(buffer: Buffer): number {
  let value = 0xffffffff
  for (const byte of buffer) {
    value ^= byte
    for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? (value >>> 1) ^ 0xedb88320 : value >>> 1
  }
  return (value ^ 0xffffffff) >>> 0
}

function writePreview(path: string, grid: readonly (readonly number[])[], scale: number): void {
  const height = grid.length
  const width = grid[0].length
  const body: number[] = []
  for (let y = 0; y < height * scale; y += 1) {
    body.push(0)
    for (let x = 0; x < width * scale; x += 1) {
      body.push(...(grid[Math.trunc(y / scale)][Math.trunc(x / scale)] ? [30, 30, 30] : [250, 246, 232]))
    }
  }
  const chunk = (tag: string, payload: Buffer) => {
    const head = Buffer.alloc(4)
    head.writeUInt32BE(payload.length)
    const tagged = Buffer.concat([Buffer.from(tag), payload])
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE(crc32(tagged))
    return Buffer.concat([head, tagged, crc])
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width * scale, 0)
  header.writeUInt32BE(height * scale, 4)
  header[8] = 8
  header[9] = 2
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(Buffer.from(body))),
    chunk('IEND', Buffer.alloc(0)),
  ]))
}

describe('아틀라스로 실제 찍어 보기', () => {
  it('한 문단을 찍은 점 그림이 원본과 같다', () => {
    const atlases = {
      hangul: readAtlasAlpha(`public/${HANGUL_ATLAS.atlas.replace('./', '')}`),
      ascii: readAtlasAlpha(`public/${ASCII_ATLAS.atlas.replace('./', '')}`),
    }
    // 글상자 글꼴(자간 2 · 줄간 2) — 참조 그림이 그 값으로 그려졌다
    const layout = layoutPixelText(SAMPLE, { letterGap: 2, lineGap: 2 })
    const grid = Array.from({ length: layout.height }, () => new Array<number>(layout.width).fill(0))

    for (const piece of layout.pieces) {
      const atlas = atlases[piece.atlas]
      for (let y = 0; y < piece.height; y += 1) {
        for (let x = 0; x < piece.width; x += 1) {
          if (atlas.rows[piece.row * piece.height + y][piece.column * piece.width + x] > 0) {
            grid[piece.y + y][piece.x + x] = 1
          }
        }
      }
    }

    const preview = process.env.PIXEL_FONT_PNG
    if (preview !== undefined) writePreview(preview, grid, 3)

    let hash = 0x811c9dc5
    for (const byte of new TextEncoder().encode(grid.map((row) => row.join('')).join('\n'))) {
      hash = Math.imul(hash ^ byte, 0x01000193) >>> 0
    }
    expect([layout.width, layout.height]).toEqual([176, 63])
    expect(hash.toString(16)).toBe('6c9623a3')
  })
})
