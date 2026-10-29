import { test } from 'vitest'
import { recolorPixels } from '@/shared/lib/sprite/paletteSwap'

/**
 * 스프라이트 칠하기 — 구운 그림을 번호 지도와 팔레트로 다시 칠하는 계산 부분(`recolorPixels`, 캔버스 없음).
 * 크기는 선수 몸통 한 장쯤(64×96). 기준 숫자만 남긴다(기계마다 달라 실패 기준은 없다) — `pnpm bench`
 */
const WIDTH = 64
const HEIGHT = 96
const PALETTE_SIZE = 32
const 팔레트 = Array.from({ length: PALETTE_SIZE }, (_unused, index) => `#${(index * 0x070503).toString(16).padStart(6, '0').slice(-6)}`)
const 색 = new Uint8ClampedArray(WIDTH * HEIGHT * 4).fill(200)
const 번호 = new Uint8ClampedArray(WIDTH * HEIGHT * 4).map((_unused, at) => (at % 4 === 3 ? (at % 7 === 0 ? 0 : 255) : (at >> 2) % PALETTE_SIZE))

test('스프라이트 칠하기', async ({ bench }) => {
  await bench(`팔레트 바꿔 칠하기 ${WIDTH}×${HEIGHT} (recolorPixels)`, () => {
    recolorPixels(색, 번호, 팔레트)
  }).run()
})
