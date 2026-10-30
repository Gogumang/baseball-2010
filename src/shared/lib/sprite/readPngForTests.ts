/**
 * **시험 전용** PNG 읽기 (node) — 8비트 RGBA(색 형식 6) · 팔레트(색 형식 3, 1·2·4·8비트 + tRNS) · 비비월만 읽는다.
 *
 * 뽑기 도구(`decode_pzx.py` · `apply_mpl.py`)는 RGBA 로 쓰고, `tools/repack_sprite_png.py` 가 색 256개 이하인 그림을
 * 무손실 팔레트 PNG 로 다시 쓴다(r311). 시험은 두 꼴을 같은 RGBA 로 풀어 본다.
 */
import { readFileSync } from 'node:fs'
import { inflateSync } from 'node:zlib'

export interface PngRgba {
  readonly width: number
  readonly height: number
  readonly data: Uint8ClampedArray
}

/** 파에스 거르개 — 왼 · 위 · 왼위 가운데 `왼 + 위 − 왼위` 에 가장 가까운 것 */
function paethOf(left: number, up: number, upLeft: number): number {
  const estimate = left + up - upLeft
  const toLeft = Math.abs(estimate - left)
  const toUp = Math.abs(estimate - up)
  const toUpLeft = Math.abs(estimate - upLeft)
  if (toLeft <= toUp && toLeft <= toUpLeft) return left
  return toUp <= toUpLeft ? up : upLeft
}

/** 줄 거르개(0 없음 · 1 왼 · 2 위 · 3 평균 · 4 파에스)가 더하는 값 */
function predictorOf(filter: number, left: number, up: number, upLeft: number): number {
  switch (filter) {
    case 0:
      return 0
    case 1:
      return left
    case 2:
      return up
    case 3:
      return (left + up) >> 1
    case 4:
      return paethOf(left, up, upLeft)
    default:
      throw new Error(`모르는 줄 거르개 ${filter}`)
  }
}

function unfilter(raw: Uint8Array, rowBytes: number, height: number, bytesPerPixel: number): Uint8Array {
  const out = new Uint8Array(rowBytes * height)
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (rowBytes + 1)]
    for (let x = 0; x < rowBytes; x += 1) {
      const value = raw[y * (rowBytes + 1) + 1 + x]
      const hasLeft = x >= bytesPerPixel
      const left = hasLeft ? out[y * rowBytes + x - bytesPerPixel] : 0
      const up = y > 0 ? out[(y - 1) * rowBytes + x] : 0
      const upLeft = hasLeft && y > 0 ? out[(y - 1) * rowBytes + x - bytesPerPixel] : 0
      out[y * rowBytes + x] = (value + predictorOf(filter, left, up, upLeft)) & 0xff
    }
  }
  return out
}

/** 읽은 덩이들 — 머리(IHDR) 값 · 색표 · 투명도 · 그림 덩이(IDAT) */
interface PngChunks {
  width: number
  height: number
  depth: number
  colorType: number
  palette: Uint8Array | null
  alphas: Uint8Array
  readonly data: Buffer[]
}

/** IHDR — 8비트 RGBA · 1·2·4·8비트 팔레트 · 비비월만 */
function readHeader(png: PngChunks, body: Buffer, name: string): void {
  png.width = body.readUInt32BE(0)
  png.height = body.readUInt32BE(4)
  png.depth = body[8]
  png.colorType = body[9]
  const isRgba = png.colorType === 6 && png.depth === 8
  const isPalette = png.colorType === 3 && [1, 2, 4, 8].includes(png.depth)
  if ((!isRgba && !isPalette) || body[12] !== 0) throw new Error(`RGBA 8비트 · 팔레트 비비월이 아니다: ${name}`)
}

function readPngChunks(bytes: Buffer, name: string): PngChunks {
  const png: PngChunks = { width: 0, height: 0, depth: 0, colorType: 0, palette: null, alphas: new Uint8Array(0), data: [] }
  let at = 8
  while (at < bytes.length) {
    const length = bytes.readUInt32BE(at)
    const type = bytes.toString('latin1', at + 4, at + 8)
    const body = bytes.subarray(at + 8, at + 8 + length)
    if (type === 'IHDR') readHeader(png, body, name)
    else if (type === 'PLTE') png.palette = body
    else if (type === 'tRNS') png.alphas = body
    else if (type === 'IDAT') png.data.push(body)
    at += 12 + length
  }
  return png
}

/** 팔레트 줄들 → RGBA (한 바이트에 8 / 깊이 개, 높은 비트부터) */
function paletteToRgba(rows: Uint8Array, png: PngChunks, palette: Uint8Array, data: Uint8ClampedArray): void {
  const { width, height, depth, alphas } = png
  const rowBytes = Math.ceil((width * depth) / 8)
  const perByte = 8 / depth
  const mask = (1 << depth) - 1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const byte = rows[y * rowBytes + Math.floor(x / perByte)]
      const index = (byte >> ((perByte - 1 - (x % perByte)) * depth)) & mask
      const out = (y * width + x) * 4
      data[out] = palette[index * 3]
      data[out + 1] = palette[index * 3 + 1]
      data[out + 2] = palette[index * 3 + 2]
      data[out + 3] = index < alphas.length ? alphas[index] : 255
    }
  }
}

/** PNG 바이트 → RGBA */
export function decodePngRgba(file: Uint8Array, name = 'PNG'): PngRgba {
  const png = readPngChunks(Buffer.from(file.buffer, file.byteOffset, file.byteLength), name)
  const { width, height } = png
  const raw = inflateSync(Buffer.concat(png.data))
  const data = new Uint8ClampedArray(width * height * 4)
  if (png.colorType === 6) {
    data.set(unfilter(raw, width * 4, height, 4))
    return { width, height, data }
  }
  if (png.palette === null) throw new Error(`색표(PLTE)가 없다: ${name}`)
  paletteToRgba(unfilter(raw, Math.ceil((width * png.depth) / 8), height, 1), png, png.palette, data)
  return { width, height, data }
}

/** PNG 파일 → RGBA */
export function readPngRgba(path: string): PngRgba {
  return decodePngRgba(readFileSync(path), path)
}
