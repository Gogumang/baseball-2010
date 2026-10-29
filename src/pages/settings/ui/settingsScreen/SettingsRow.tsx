import { FrameSprite, PressArea } from '@/shared/ui'
import type { FrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { DETAIL_COLORS, FIRST_MENU_ROW, MENU_ROW, VALUE_ROW } from '@/pages/settings/lib/settingsLayout'
import * as styles from '@/pages/settings/ui/SettingsScreen.css'
import { SLT_FRAME, SLT_FRAMES, VALUE_ARROW_TOUCH_PAD, imageSrc } from '@/pages/settings/ui/settingsScreen/settingsAssets'
import { ValueRowParts } from '@/pages/settings/ui/settingsScreen/ValueRowParts'
import { rowIconOf } from '@/pages/settings/ui/settingsScreen/rowIcons'

/** 막대 그림 — 값 줄은 진동(2)만 따로, 메뉴 줄은 하나 */
function barFrameOf(index: number, isValueRow: boolean) {
  if (!isValueRow) return MENU_ROW.barFrame
  return index === 2 ? VALUE_ROW.vibrationBarFrame : VALUE_ROW.barFrame
}

/** 메뉴 줄 이름 — 고른 줄은 흰색 */
function MenuRowName({
  name,
  top,
  isSelected,
  dx,
  dy,
}: {
  readonly name: string
  readonly top: number
  readonly isSelected: boolean
  readonly dx: number
  readonly dy: number
}) {
  return (
    <div
      className={styles.menuName}
      style={{
        left: MENU_ROW.name.x + dx,
        top: top + MENU_ROW.name.dy + dy,
        width: MENU_ROW.name.width,
        color: isSelected ? DETAIL_COLORS.selected : DETAIL_COLORS.unselected,
      }}
    >
      {name}
    </div>
  )
}

interface SettingsRowProps {
  readonly index: number
  readonly name: string
  readonly top: number
  readonly settings: GameSettings
  readonly isSelected: boolean
  /** 화살·흰 테두리는 고른 줄이 깜빡일 때만 — 펴는 동안은 0x59548 이 끈다 */
  readonly isBlinkOn: boolean
  /** 까딱임은 줄 루프(0x59644~0x598f2)의 그림에만 — 아이콘 · 값 그림(0x59902~)과 진동 값 테두리는 제자리다 */
  readonly shift: { readonly dx: number; readonly dy: number }
  readonly frames: FrameOrigins | null
  readonly onPress: (index: number) => void
  /** 값 줄 왼 화살 자리 누름 — 값을 하나 내린다 */
  readonly onLower: (index: number) => void
}

/** 첫 화면 한 줄 — 값 줄 0~2 · 메뉴 줄 3~5 */
export function SettingsRow({ index, name, top, settings, isSelected, isBlinkOn, shift, frames, onPress, onLower }: SettingsRowProps) {
  const isValueRow = index < FIRST_MENU_ROW
  const bar = isValueRow ? VALUE_ROW.bar : MENU_ROW.bar
  const bullet = isValueRow ? VALUE_ROW : MENU_ROW
  const icon = rowIconOf(index, settings)
  const { dx, dy } = shift
  return (
    <div>
      <img
        className={styles.sprite}
        alt=""
        src={imageSrc(SLT_FRAME, isSelected ? bullet.selectedBulletImage : bullet.bulletImage)}
        style={{ left: bullet.bullet.x + dx, top: top + bullet.bullet.dy + dy }}
      />
      <FrameSprite folder={SLT_FRAMES} frame={barFrameOf(index, isValueRow)} origins={frames} x={bar.x + dx} y={top + bar.dy + dy} />

      {isValueRow && icon !== undefined ? (
        <ValueRowParts index={index} name={name} top={top} icon={icon} settings={settings} isBlinkOn={isBlinkOn} shift={shift} />
      ) : (
        <MenuRowName name={name} top={top} isSelected={isSelected} dx={dx} dy={dy} />
      )}

      {isBlinkOn && (
        <div className={styles.selectedOutline} style={{ left: bar.x + dx, top: top + bar.dy + dy, width: bar.width, height: bar.height }} />
      )}

      <button
        type="button"
        className={styles.row}
        aria-label={name}
        style={{ left: bar.x, top: top + bar.dy, width: bar.width, height: bar.height }}
        onClick={() => onPress(index)}
      />
      {/* 터치 −1 (웹 껍데기): 원본 왼 화살(이미지 20, 5×8) 자리의 투명 칸 — 왼 키(−3)와 같이 값을 하나 내린다.
          줄을 누르면 +1(오른 키 · OK 와 같은 갈래)이라 내리는 길이 없었다 */}
      {isValueRow && (
        <PressArea
          label={`${name} 내리기`}
          testId={`설정내리기-${index}`}
          rect={{
            x: VALUE_ROW.leftArrow.x - VALUE_ARROW_TOUCH_PAD,
            y: top + bar.dy,
            width: bar.x - VALUE_ROW.leftArrow.x + VALUE_ARROW_TOUCH_PAD,
            height: bar.height,
          }}
          onPress={() => onLower(index)}
        />
      )}
    </div>
  )
}
