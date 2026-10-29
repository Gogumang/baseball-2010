import { useEffect, useState } from 'react'
import { useSpriteJson } from '@/shared/lib/sprite/useSpriteJson'
import { paletteUrl, type SpritePalettes } from '@/shared/lib/sprite/palettePixels'
import { readyRecoloredSpriteUrl, recoloredSpriteUrl } from '@/shared/lib/sprite/recolorPaint'

/** 팔레트를 갈아 끼운 그림. 칠하기 전에는 구운 그림을 그대로 내보내 화면이 비지 않는다. */
export function useRecoloredSprite(spriteUrl: string, paletteIndex: number | null): string {
  // 벌을 안 고르면(null) palette.json 을 청하지 않는다 — 팔레트가 없는 폴더(batter_batter 따위)가 404 를 내던 일 (r124 측정)
  const palettes = useSpriteJson<SpritePalettes>(paletteIndex === null ? null : paletteUrl(spriteUrl))
  // 이미 칠한 그림이면 그리는 그 자리에서 곧장 쓴다 — 프레임이 바뀔 때마다 구운 색(다른 팀 색)이
  // 한 번 비치고 구운 그림 요청이 끊기던 일을 막는다. 아직 칠하는 중이면 지금까지처럼 구운 그림이다
  const ready = readyRecoloredSpriteUrl(spriteUrl, palettes, paletteIndex)
  const key = `${spriteUrl}#${paletteIndex ?? ''}`
  const [painted, setPainted] = useState<{ readonly key: string; readonly url: string } | null>(null)

  useEffect(() => {
    if (readyRecoloredSpriteUrl(spriteUrl, palettes, paletteIndex) !== null) return
    let isActive = true
    recoloredSpriteUrl(spriteUrl, palettes, paletteIndex).then((url) => {
      if (isActive) setPainted({ key, url })
    })
    return () => {
      isActive = false
    }
  }, [spriteUrl, palettes, paletteIndex, key])

  return ready ?? (painted !== null && painted.key === key ? painted.url : spriteUrl)
}
