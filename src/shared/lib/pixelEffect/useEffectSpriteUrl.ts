import { useEffect, useState } from 'react'
import { effectSpriteUrl, paintedEffectSpriteUrlOf } from '@/shared/lib/pixelEffect/pixelEffect'

/**
 * 화면을 안 보는 효과(0xa 회색 · 0xb 단색 · 0xc 반반 · 0xd 색 더하기)를 입힌 그림 주소 — 칠하는 동안은 `null`.
 * `backdrop`(565)을 주면 그 한 색 화면 위에 그린 결과라 화면을 보는 효과(1 반투명 · 2 더하기)도 원본 식 그대로다.
 * `url` 이 `null` 이면 늘 `null`. 칠하기는 `effectSpriteUrl` 이 그림 · 효과 · 인자(· 바탕)마다 한 번만 한다.
 */
export function useEffectSpriteUrl(url: string | null, effect: number, argument: number, backdrop: number | null = null): string | null {
  const [painted, setPainted] = useState<{ readonly key: string; readonly url: string } | null>(null)
  const key = url === null ? null : `${url}#${effect}:${argument}@${backdrop ?? ''}`
  useEffect(() => {
    if (url === null || key === null) return
    let isLive = true
    void effectSpriteUrl(url, effect, argument, backdrop).then((to) => {
      if (isLive) setPainted({ key, url: to })
    })
    return () => {
      isLive = false
    }
  }, [url, key, effect, argument, backdrop])
  if (painted !== null && painted.key === key) return painted.url
  // 다른 자리에서 이미 칠해 둔 그림이면 기다리지 않는다
  return url === null ? null : paintedEffectSpriteUrlOf(url, effect, argument, backdrop)
}
