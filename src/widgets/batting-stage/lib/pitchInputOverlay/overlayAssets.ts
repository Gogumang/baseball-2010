/** 사람 투구 UI 그림 자리 — `ui/slt_pitch.pzx`([+0x1010]) · num · game_effect */
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

export const SLT_FRAMES = assetUrl('./sprites/slt_pitch/frames')
export const SLT_IMAGE = (index: number) => assetUrl(`./sprites/slt_pitch/${String(index).padStart(3, '0')}.png`)
export const NUM_IMAGE = (index: number) => assetUrl(`./sprites/num/${String(index).padStart(3, '0')}.png`)
export const GAME_EFFECT_FRAMES = assetUrl('./sprites/game_effect/frames')

/** 마구 구질 번호 */
export const MAGIC_TYPE_NUMBER = 22
