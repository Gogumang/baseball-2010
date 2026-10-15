import { useEffect, useState } from 'react'
import { effectSpriteUrl } from '@/shared/lib/pixelEffect/pixelEffect'

/**
 * 화면을 안 보는 효과(0xa 회색 · 0xb 단색 · 0xc 반반 · 0xd 색 더하기)를 입힌 그림 주소 — 칠하는 동안은 `null`.
 * `url` 이 `null` 이면 늘 `null`. 칠하기는 `effectSpriteUrl` 이 그림 · 효과 · 인자마다 한 번만 한다.
 */
export function useEffectSpriteUrl(url: string | null, effect: number, argument: number): string | null {
  const [painted, setPainted] = useState<{ readonly key: string; readonly url: string } | null>(null)
  const key = url === null ? null : `${url}#${effect}:${argument}`
  useEffect(() => {
    if (url === null || key === null) return
    let isLive = true
    void effectSpriteUrl(url, effect, argument).then((to) => {
      if (isLive) setPainted({ key, url: to })
    })
    return () => {
      isLive = false
    }
  }, [url, key, effect, argument])
  return painted !== null && painted.key === key ? painted.url : null
}
