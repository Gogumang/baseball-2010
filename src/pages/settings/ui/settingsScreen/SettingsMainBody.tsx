import { CommonPanel, FrameSprite } from '@/shared/ui'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import { PANEL, SCREEN, SETTINGS_DESCRIPTIONS, TITLE, panelClipOf, rowTopOf } from '@/pages/settings/lib/settingsLayout'
import { DescriptionBand } from '@/shared/ui/DescriptionBand/DescriptionBand'
import { IMG_TEXT, NO_SHIFT } from '@/pages/settings/ui/settingsScreen/settingsAssets'
import { PanelClip } from '@/pages/settings/ui/settingsScreen/SettingsPanels'
import { SettingsRow } from '@/pages/settings/ui/settingsScreen/SettingsRow'
import { SettingsOkButton, VibrationValueOutline } from '@/pages/settings/ui/settingsScreen/SettingsOkButton'
import type { SettingsScreenState } from '@/pages/settings/ui/settingsScreen/useSettingsScreen'

/**
 * 첫 화면 본문 — 판 · 제목 · 줄 · 진동 값 테두리 · OK · 설명 띠.
 * 이번에 그리는 판 높이 — 판은 화면 가운데를 기준으로 위아래로 펴진다.
 * 판 = `0x55e60(skin, W/2, H/2, 192, h, 0, 정렬 0x22, 0, 0, 제목 탭 1, 0)` (0x594f4~0x59510) — 왼쪽 위 제목 탭 모양.
 * 알파 · 띠 · 어둡게 자리의 r7 = [skin+0x84] 는 여기까지 오면 늘 0 이다(`isPageShown` 머리말).
 */
export function SettingsMainBody({ state, settings }: { readonly state: SettingsScreenState; readonly settings: GameSettings }) {
  const { panel, names } = state.shape
  const { cursor } = state
  /** 판·제목·줄·OK 가 y0 를 따라 내려가는 만큼 */
  const panelDy = panel.y - PANEL.y
  const drawnHeight = Math.min(state.fold.height, panel.height)
  const isUnfolded = drawnHeight >= panel.height
  const clip = panelClipOf(drawnHeight, panel.height)
  return (
    <>
      {state.titlePalette.definition}
      <CommonPanel x={panel.x} y={SCREEN.height / 2 - Math.trunc(drawnHeight / 2)} width={panel.width} height={drawnHeight} titleTab />
      <PanelClip x={panel.x} y={clip.y} width={panel.width} height={clip.height}>
        {/* 제목 img_text 289 — 팔레트 3(#2949A5 · #10246B) 으로 그린다 (0x59572~0x595cc: 0x913e5(img_text, 3) 뒤 0xba759) */}
        <FrameSprite
          folder={IMG_TEXT}
          frame={TITLE.frame}
          origins={state.titleFrames}
          x={TITLE.x}
          y={TITLE.y + panelDy}
          style={state.titlePalette.style}
        />
        {names.map((name, index) => (
          <SettingsRow
            key={name}
            index={index}
            name={name}
            top={rowTopOf(index) + panelDy}
            settings={settings}
            isSelected={index === cursor}
            isBlinkOn={index === cursor && state.isOutlineShown && isUnfolded}
            shift={index === cursor ? state.rowShake.offset : NO_SHIFT}
            frames={state.frames}
            onPress={(pressed) => {
              state.setCursor(pressed)
              state.openRow(pressed)
            }}
            onLower={(pressed) => {
              state.setCursor(pressed)
              state.changeValue(-1, pressed)
            }}
          />
        ))}
        {names.length > 2 && <VibrationValueOutline isOn={settings.isVibrationOn} panelDy={panelDy} />}
        <SettingsOkButton
          panelHeight={panel.height}
          isSelected={state.isOkSelected}
          onPress={() => {
            state.setCursor(state.okCell)
            state.leave()
          }}
        />
      </PanelClip>

      {/* 설명 띠 0x55544 — StrMAINMENU[0x20 + 커서]. OK 칸이거나 경기 중이면 안 그린다 (0x59e64 앞 갈래) */}
      {!state.isInGame && !state.isOkSelected && <DescriptionBand text={SETTINGS_DESCRIPTIONS[cursor] ?? ''} seed={cursor} />}
    </>
  )
}
