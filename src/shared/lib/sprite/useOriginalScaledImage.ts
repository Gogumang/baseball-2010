import { useEffect, useState } from 'react'
import { packedPixelsOf, rgbaOfPacked, scalePixelsLikeOriginal } from '@/shared/lib/sprite/originalScale'

/**
 * 원본 식(0x662dc → 0x65f64, `originalScale`)으로 미리 줄인 그림 — 캔버스로 한 번 만들어 (그림, 폭, 높이) 마다 캐시한다.
 * 0x663c4 가 로고 버퍼를 한 번 만들어 두고 0x66431 이 제 크기로 찍는 것과 같다.
 */
export interface ScaledImage {
  readonly src: string
  readonly width: number
  readonly height: number
}

const requests = new Map<string, Promise<ScaledImage | null>>()
const ready = new Map<string, ScaledImage>()

const keyOf = (url: string, width: number, height: number) => `${url}#${width}x${height}`

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`그림을 불러오지 못했습니다: ${url}`))
    image.src = url
  })
}

async function scaleImage(url: string, width: number, height: number): Promise<ScaledImage | null> {
  const image = await loadImage(url)
  const canvas = document.createElement('canvas')
  canvas.width = image.naturalWidth
  canvas.height = image.naturalHeight
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (context === null || canvas.width === 0 || canvas.height === 0) return null
  context.drawImage(image, 0, 0)
  const source = packedPixelsOf(context.getImageData(0, 0, canvas.width, canvas.height).data)
  const scaled = scalePixelsLikeOriginal(source, canvas.width, canvas.height, width, height)
  if (scaled === null || scaled.width <= 0 || scaled.height <= 0) return null
  const output = document.createElement('canvas')
  output.width = scaled.width
  output.height = scaled.height
  const outputContext = output.getContext('2d')
  if (outputContext === null) return null
  const data = outputContext.createImageData(scaled.width, scaled.height)
  data.data.set(rgbaOfPacked(scaled.pixels))
  outputContext.putImageData(data, 0, 0)
  return { src: output.toDataURL('image/png'), width: scaled.width, height: scaled.height }
}

/** 원본 식으로 줄인 그림 (캐시). 실패하면 null — 실패는 캐시에 남기지 않는다 */
export function originalScaledImage(url: string, width: number, height: number): Promise<ScaledImage | null> {
  const key = keyOf(url, width, height)
  const cached = requests.get(key)
  if (cached !== undefined) return cached
  const request = scaleImage(url, width, height).then(
    (result) => {
      if (result === null) requests.delete(key)
      else ready.set(key, result)
      return result
    },
    () => {
      requests.delete(key)
      return null
    },
  )
  requests.set(key, request)
  return request
}

/**
 * 원본 식으로 줄인 그림. 다 줄이기 전(또는 캔버스가 없을 때)에는 원본 그림을 폭 × 높이 로 그대로 내보낸다 — 브라우저 축소라
 * 픽셀이 다를 수 있지만 자리는 같다.
 */
export function useOriginalScaledImage(url: string, width: number, height: number): ScaledImage {
  const key = keyOf(url, width, height)
  const done = ready.get(key)
  const [, setVersion] = useState(0)

  useEffect(() => {
    if (ready.has(key)) return
    let isActive = true
    originalScaledImage(url, width, height).then((result) => {
      if (isActive && result !== null) setVersion((version) => version + 1)
    })
    return () => {
      isActive = false
    }
  }, [key, url, width, height])

  return done ?? { src: url, width, height }
}
