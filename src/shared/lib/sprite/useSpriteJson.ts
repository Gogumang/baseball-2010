import { useEffect, useState } from 'react'
import { loadSpriteJson, readySpriteJson } from '@/shared/lib/sprite/spriteCache'

/**
 * 디코더가 스프라이트 옆에 남긴 JSON. 아직 오지 않았거나 실패하면 null — 화면은 그림 없이도 진행된다.
 * 캐시는 캔버스·미리 받기와 같이 쓴다(`spriteCache` — 실패한 주소는 다음 부를 때 다시 받는다).
 * **이미 와 있으면 첫 렌더부터** 값을 돌려준다 — 미리 받아 둔 origins 를 effect 한 바퀴 기다리느라 한 프레임 비우지 않게.
 */
export function useSpriteJson<T>(url: string): T | null {
  const [value, setValue] = useState<T | null>(null)
  const ready = readySpriteJson<T>(url)

  useEffect(() => {
    let isActive = true
    loadSpriteJson<T>(url)
      .then((loaded) => {
        if (isActive) setValue(loaded)
      })
      .catch(() => {
        if (isActive) setValue(null)
      })
    return () => {
      isActive = false
    }
  }, [url])

  return ready !== undefined ? ready.value : value
}
