import { useEffect, useState } from 'react'

const cache = new Map<string, Promise<unknown>>()

function loadJson(url: string): Promise<unknown> {
  const cached = cache.get(url)
  if (cached !== undefined) return cached

  const request = fetch(url).then((response) => {
    if (!response.ok) throw new Error(`스프라이트 정보를 불러오지 못했습니다 (${response.status}): ${url}`)
    return response.json() as Promise<unknown>
  })
  // 실패한 요청을 캐시에 남기면 일시적 오류가 영영 고착된다.
  request.catch(() => cache.delete(url))
  cache.set(url, request)
  return request
}

/** 디코더가 스프라이트 옆에 남긴 JSON. 아직 오지 않았거나 실패하면 null — 화면은 그림 없이도 진행된다. */
export function useSpriteJson<T>(url: string): T | null {
  const [value, setValue] = useState<T | null>(null)

  useEffect(() => {
    let isActive = true
    loadJson(url)
      .then((loaded) => {
        if (isActive) setValue(loaded as T)
      })
      .catch(() => {
        if (isActive) setValue(null)
      })
    return () => {
      isActive = false
    }
  }, [url])

  return value
}
