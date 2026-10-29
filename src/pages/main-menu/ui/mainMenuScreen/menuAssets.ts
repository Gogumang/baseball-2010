import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const MAIN_UI = assetUrl('./sprites/main_ui')
export const IMG_TEXT = assetUrl('./sprites/img_text')
export const pad = (frame: number) => String(frame).padStart(3, '0')
/** 합성 프레임 (main_ui/frames · img_text/frames) */
export const frameSrc = (folder: string, frame: number) => `${folder}/frames/${pad(frame)}.png`
/** 통짜 이미지 (main_ui/NNN) — 설명 판이 이쪽이다 */
export const imageSrc = (frame: number) => `${MAIN_UI}/${pad(frame)}.png`

/** 고른 칸에서 `offset` 칸 떨어진 칸까지의 걸음 — 감기는 배열이라 가까운 쪽(절반 넘으면 반대쪽)으로 잰다 */
export const slotOffsetOf = (offset: number, count: number) => {
  const forward = ((offset % count) + count) % count
  return forward > count / 2 ? forward - count : forward
}
