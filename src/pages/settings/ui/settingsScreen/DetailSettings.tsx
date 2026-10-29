import { useEffect, useState } from 'react'
import { FrameSprite, RawScreen, useImgTextPalette3 } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useSkinBlinkCounter } from '@/shared/lib/skinBlink/skinBlink'
import { useCursorShake } from '@/shared/lib/cursorShake/useCursorShake'
import { noteSkinShakeKey } from '@/shared/lib/cursorShake/skinShakeDirection'
import { isFrameSlidingAt } from '@/widgets/screen-frame/lib/frameSlide'
import type { GameSettings } from '@/entities/settings/model/gameSettings'
import {
  DETAIL_DESCRIPTIONS,
  DETAIL_ROWS,
  DETAIL_ROW_COUNT,
  DETAIL_TITLE,
  PANEL,
  isSelectedOutlineShown,
  panelClipOf,
} from '@/pages/settings/lib/settingsLayout'
import { DescriptionBand } from '@/shared/ui/DescriptionBand/DescriptionBand'
import {
  BACK_KEYS,
  CONFIRM_KEYS,
  IMG_TEXT,
  NO_SHIFT,
  SLT_FRAMES,
  gridKeyOf,
  horizontalStepOf,
  verticalStepOf,
} from '@/pages/settings/ui/settingsScreen/settingsAssets'
import { PanelClip, SettingsFrame, UnfoldingPanel } from '@/pages/settings/ui/settingsScreen/SettingsPanels'
import { detailValuesOf, toggleDetail } from '@/pages/settings/ui/settingsScreen/detailSettingsValues'
import { DetailRow } from '@/pages/settings/ui/settingsScreen/DetailRow'

interface DetailSettingsProps {
  readonly settings: GameSettings
  readonly onChange: (settings: GameSettings) => void
  readonly mainMenu: { readonly gamePoint: number } | undefined
  /** 이번에 그리는 판 높이 — 첫 화면이 들고 있는 펼침(`nextPanelFold`) */
  readonly panelHeight: number
  /** 머리띠가 다 내려왔나 — 아니면 0x593c8 이 아무것도 안 그린다 (`SettingsScreen` 의 `isPageShown`) */
  readonly isPageShown: boolean
  readonly onBack: () => void
}

/**
 * 갱신 0x288ac 가 OK(−5) · 좌우(−3 · −4) · '4'(0x34) · '6'(0x36) 을 모두 같은 갈래 0x28920(칸 값 ^= 1)으로 보낸다 — 확정.
 * '5' 는 격자가 −5 로 바꿔 돌려주므로 같은 갈래다 (`gridKeyOf`)
 */
const isToggleKey = (key: string) => CONFIRM_KEYS.has(key) || horizontalStepOf(key) !== 0

/**
 * 환경설정 → **상세 설정** (원본 장면 상태 0x20 · 페이지 32 — 그리기 4줄 루프, P7 K2 확정).
 *
 * 투구 · 주루 · 송구 · 전광판 네 줄이고, 줄마다 두 칸 중 지금 값이 흰색으로 나온다.
 * 다섯째 줄 "터치"(StrMAINMENU[73], 옵션 +0x14c)는 원본이 값만 읽고 그리지 않아 여기도 없다.
 *
 * 배치는 그리기 0x59e82~0x5a2f4 를 직접 뜬 값이다 (`settingsLayout.ts` 의 `DETAIL_*` 주석) — 아래 OK 단추는 없다.
 * 웹판에 배선이 없는 값(송구·전광판)도 **원본에 줄이 있으므로 그대로 보여 주고 저장한다.**
 */
export function DetailSettings({ settings, onChange, mainMenu, panelHeight, isPageShown, onBack }: DetailSettingsProps) {
  const [cursor, setCursor] = useState(0)
  const tick = useUpdateCounter()
  const isOutlineShown = isSelectedOutlineShown(useSkinBlinkCounter(tick))
  /** 고른 줄 까딱임 — 같은 표 0xd1784 · 0xd1754 (0x59f04~0x59f4a) */
  const rowShake = useCursorShake(tick)
  const frames = useFrameOrigins(SLT_FRAMES)
  const titleFrames = useFrameOrigins(IMG_TEXT)
  const titlePalette = useImgTextPalette3()
  const values = detailValuesOf(settings)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      // 숫자키 꼴 1 격자 — '2' '8' '4' '6' '5' 를 ↑ ↓ ← → OK 로 (`gridKeyOf`)
      const key = gridKeyOf(event.key)
      // 격자가 바꾼 키를 0x5550d 에도 넘긴다(2958a · 288e4 · 2c706) — 화살표 꼴이면 [skin+0x8c] 에 남는다(Q-10)
      noteSkinShakeKey(key)
      const vertical = verticalStepOf(key)
      if (vertical !== 0) {
        event.preventDefault()
        // 0x20 진입 0x2421c 가 머리띠를 다시 미끄러뜨린다 — 그동안은 페이지를 안 그리고 +0x25 만 지운다(0x5a772)
        if (!isFrameSlidingAt(tick)) rowShake.start(vertical > 0 ? 'down' : 'up')
        return setCursor((previous) => (previous + vertical + DETAIL_ROW_COUNT) % DETAIL_ROW_COUNT)
      }
      // CLR(−16)은 판·키 상태와 상관없이 곧바로 상태 8 (0xbcb49(…, 8)) — 펴는 도중에도 키를 받는다
      if (isToggleKey(key)) {
        event.preventDefault()
        return onChange(toggleDetail(settings, cursor))
      }
      if (BACK_KEYS.has(key)) {
        event.preventDefault()
        onBack()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const isUnfolded = panelHeight >= PANEL.height
  const clip = panelClipOf(panelHeight, PANEL.height)
  return (
    <RawScreen>
      {isPageShown && (
        <>
          {titlePalette.definition}
          <UnfoldingPanel height={panelHeight} />
          <PanelClip x={PANEL.x} y={clip.y} width={PANEL.width} height={clip.height}>
            {/* 제목 img_text 290 — 팔레트 3 (0x59e82~0x59eae `0x913e5(img_text, 3)`) */}
            <FrameSprite
              folder={IMG_TEXT}
              frame={DETAIL_TITLE.frame}
              origins={titleFrames}
              x={DETAIL_TITLE.x}
              y={DETAIL_TITLE.y}
              style={titlePalette.style}
            />
            {DETAIL_ROWS.map((row, index) => (
              <DetailRow
                key={row.name}
                index={index}
                value={values[index]}
                isSelected={index === cursor}
                isBlinkOn={index === cursor && isOutlineShown && isUnfolded}
                shift={index === cursor ? rowShake.offset : NO_SHIFT}
                frames={frames}
                onPress={(pressed) => {
                  setCursor(pressed)
                  onChange(toggleDetail(settings, pressed))
                }}
              />
            ))}
            {/* 이 페이지에는 아래 OK 단추가 없다 — 나가는 길은 CLR(머리띠 되돌아가기)뿐이다 */}
          </PanelClip>
          {/* 설명 띠 0x5a310 — StrMAINMENU[0x26 + 커서], 조건 없이 */}
          <DescriptionBand text={DETAIL_DESCRIPTIONS[cursor] ?? ''} seed={cursor} />
        </>
      )}
      <SettingsFrame mainMenu={mainMenu} onBack={onBack} />
    </RawScreen>
  )
}
