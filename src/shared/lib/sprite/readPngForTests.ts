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

function unfilter(raw: Uint8Array, rowBytes: number, height: number, bytesPerPixel: number): Uint8Array {
  const out = new Uint8Array(rowBytes * height)
  for (let y = 0; y < height; y += 1) {
    const filter = raw[y * (rowBytes + 1)]
    for (let x = 0; x < rowBytes; x += 1) {
      const value = raw[y * (rowBytes + 1) + 1 + x]
      const left = x >= bytesPerPixel ? out[y * rowBytes + x - bytesPerPixel] : 0
      const up = y > 0 ? out[(y - 1) * rowBytes + x] : 0
      const upLeft = x >= bytesPerPixel && y > 0 ? out[(y - 1) * rowBytes + x - bytesPerPixel] : 0
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
      } else if (filter !== 0) throw new Error(`모르는 줄 거르개 ${filter}`)
      out[y * rowBytes + x] = (value + predictor) & 0xff
    }
  }
  return out
}

/** PNG 바이트 → RGBA */
export function decodePngRgba(file: Uint8Array, name = 'PNG'): PngRgba {
  const bytes = Buffer.from(file.buffer, file.byteOffset, file.byteLength)
  let at = 8
  let width = 0
  let height = 0
  let depth = 0
  let colorType = 0
  let palette: Uint8Array | null = null
  let alphas: Uint8Array = new Uint8Array(0)
  const chunks: Buffer[] = []
  while (at < bytes.length) {
    const length = bytes.readUInt32BE(at)
    const type = bytes.toString('latin1', at + 4, at + 8)
    const body = bytes.subarray(at + 8, at + 8 + length)
    if (type === 'IHDR') {
      width = body.readUInt32BE(0)
      height = body.readUInt32BE(4)
      depth = body[8]
      colorType = body[9]
      const isRgba = colorType === 6 && depth === 8
      const isPalette = colorType === 3 && [1, 2, 4, 8].includes(depth)
      if ((!isRgba && !isPalette) || body[12] !== 0) throw new Error(`RGBA 8비트 · 팔레트 비비월이 아니다: ${name}`)
    } else if (type === 'PLTE') palette = body
    else if (type === 'tRNS') alphas = body
    else if (type === 'IDAT') chunks.push(body)
    at += 12 + length
  }
  const raw = inflateSync(Buffer.concat(chunks))
  const data = new Uint8ClampedArray(width * height * 4)
  if (colorType === 6) {
    data.set(unfilter(raw, width * 4, height, 4))
    return { width, height, data }
  }
  if (palette === null) throw new Error(`색표(PLTE)가 없다: ${name}`)
  const rowBytes = Math.ceil((width * depth) / 8)
  const rows = unfilter(raw, rowBytes, height, 1)
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
  return { width, height, data }
}

/** PNG 파일 → RGBA */
export function readPngRgba(path: string): PngRgba {
  return decodePngRgba(readFileSync(path), path)
}
