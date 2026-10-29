import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const IMG_TEXT = assetUrl('./sprites/img_text/frames')
/** 칸 글 img_text 폴더 · 프레임 그림 */
export const RECORD_PICK_LABEL_FOLDER = IMG_TEXT
export const recordPickLabelSrcOf = (frame: number) => `${IMG_TEXT}/${String(frame).padStart(3, '0')}.png`

/** `ui/mode_icon.pzx` 그림 · 33×33. mpl 첫 벌(주황)로 칠한 사본은 tools/generate_management_sprites.py 가 만든다 */
export const MODE_ICON_SIZE = 33
export const modeIconOf = (frame: number) => assetUrl(`./sprites/mode_icon/${String(frame).padStart(3, '0')}.png`)
export const selectedModeIconOf = (frame: number) => assetUrl(`./sprites/management/icon_selected_${frame}.png`)

export const pixel = { position: 'absolute', pointerEvents: 'none' } as const
