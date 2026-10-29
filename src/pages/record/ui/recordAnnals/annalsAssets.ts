import type { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { AnnalsDirection } from '@/pages/record/lib/annalsGrid'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const SLT_FRAME = assetUrl('./sprites/slt_frame')
export const SLT_FRAMES = `${SLT_FRAME}/frames`
export const IMG_TEXT = assetUrl('./sprites/img_text/frames')

export const imageSrc = (folder: string, id: number) => `${folder}/${String(id).padStart(3, '0')}.png`

export type Origins = ReturnType<typeof useFrameOrigins>

/** 탭 이름 그림 폭 — 원본은 `0xba815(…, img_text, 276+탭, 1)` 로 크기를 재 가운데를 맞춘다 (0x2e546) */
export const nameWidthOf = (origins: Origins, frame: number) => origins?.[String(frame).padStart(3, '0')]?.width ?? 0

/** 화면 크기 — 판 안 그림을 자르는 clip-path 를 잴 때 쓴다 */
export const SCREEN = { width: 240, height: 320 } as const

/** 본문 키 → 방향. 격자 꼴 1 은 숫자 2·4·6·8 을 ↑ ← → ↓ 로 바꾼다 (0x6c096, 표 0xd2e7c) */
const DIRECTION_BY_KEY: ReadonlyMap<string, AnnalsDirection> = new Map([
  ['ArrowUp', 'up'],
  ['2', 'up'],
  ['ArrowDown', 'down'],
  ['8', 'down'],
  ['ArrowLeft', 'left'],
  ['4', 'left'],
  ['ArrowRight', 'right'],
  ['6', 'right'],
])
export const annalsDirectionOf = (key: string): AnnalsDirection | null => DIRECTION_BY_KEY.get(key) ?? null
