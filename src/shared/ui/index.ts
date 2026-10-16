/**
 * shared/ui 공개 API.
 *
 * 바깥 레이어(pages·widgets·features)는 이 배럴만 import 한다.
 * 컴포넌트 파일 경로가 바뀌어도 호출부가 깨지지 않게 하려는 것이다.
 */
export { PixelScreen } from '@/shared/ui/PixelScreen/PixelScreen'
export { Panel } from '@/shared/ui/Panel/Panel'
export { Hint, Notice, BigResult } from '@/shared/ui/Text/Text'
export { StatGrid } from '@/shared/ui/StatGrid/StatGrid'
export { DialogueBox } from '@/shared/ui/DialogueBox/DialogueBox'
export { TitleTag } from '@/shared/ui/TitleTag/TitleTag'
export type { StatEntry } from '@/shared/ui/StatGrid/StatGrid'
export { MenuList } from '@/shared/ui/MenuList/MenuList'
export type { MenuItem } from '@/shared/ui/MenuList/MenuList'
export { IconMenu } from '@/shared/ui/IconMenu/IconMenu'
export type { IconMenuItem } from '@/shared/ui/IconMenu/IconMenu'
export { StatusBar, AbilityBars } from '@/shared/ui/StatusBar/StatusBar'
export { MarkupText } from '@/shared/ui/MarkupText/MarkupText'
export {
  PixelNumber,
  HeadingSprite,
  HEADING_SPRITE,
  PopupLabel,
  POPUP_LABEL,
  MODE_ICON,
} from '@/shared/ui/PixelNumber/PixelNumber'
export { FrameSprite } from '@/shared/ui/FrameSprite/FrameSprite'
export { SolidStamp } from '@/shared/ui/SolidStamp/SolidStamp'
export { RawScreen } from '@/shared/ui/RawScreen/RawScreen'
export { PressArea } from '@/shared/ui/PressArea/PressArea'
export type { PressRect } from '@/shared/ui/PressArea/PressArea'
export { SpriteNumber } from '@/shared/ui/SpriteNumber/SpriteNumber'
export { MessageBox } from '@/shared/ui/MessageBox/MessageBox'
export { ScreenOverlay } from '@/shared/ui/ScreenOverlay/ScreenOverlay'
export { Button } from '@/shared/ui/Button/Button'
export type { ButtonVariant } from '@/shared/ui/Button/Button'
export { TextField } from '@/shared/ui/TextField/TextField'
export { CommonPanel, InsetBox, PaintedRects, RoundBox } from '@/shared/ui/CommonPanel/CommonPanel'
export {
  IMG_TEXT_BAKED_PALETTE, bakedImgTextPaletteOf, imgTextPaletteMatrix, useImgTextPalette3, useImgTextPalettes,
} from '@/shared/ui/ImgTextPalette/ImgTextPalette'
export type { ImgTextPaletteIndex } from '@/shared/ui/ImgTextPalette/ImgTextPalette'
export { EffectImage } from '@/shared/ui/EffectImage/EffectImage'
export { InputMethodText } from '@/shared/ui/InputMethodText/InputMethodText'
export { OriginalScaledImage } from '@/shared/ui/OriginalScaledImage/OriginalScaledImage'
