import { useEffect, useState } from 'react'
import { FrameSprite, RawScreen, useImgTextPalette3 } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useSkinBlinkCounter } from '@/shared/lib/skinBlink/skinBlink'
import { useCursorShake } from '@/shared/lib/cursorShake/useCursorShake'
import { noteSkinShakeKey } from '@/shared/lib/cursorShake/skinShakeDirection'
import { isFrameSlidingAt } from '@/widgets/screen-frame/lib/frameSlide'
import type { CareerResetEdition } from '@/entities/settings/model/modeReset'
import { MODE_RESET_ROW_COUNT, MODE_RESET_TITLE, PANEL, isSelectedOutlineShown, panelClipOf } from '@/pages/settings/lib/settingsLayout'
import { BACK_KEYS, CONFIRM_KEYS, IMG_TEXT, NO_SHIFT, SLT_FRAMES, gridKeyOf, verticalStepOf } from '@/pages/settings/ui/settingsScreen/settingsAssets'
import { PanelClip, SettingsFrame, UnfoldingPanel } from '@/pages/settings/ui/settingsScreen/SettingsPanels'
import { MODE_RESET_NAMES } from '@/pages/settings/ui/settingsScreen/modeResetChoices'
import type { ModeResetPopup } from '@/pages/settings/ui/settingsScreen/modeResetChoices'
import { ModeResetPopups } from '@/pages/settings/ui/settingsScreen/ModeResetPopups'
import { ModeResetRow } from '@/pages/settings/ui/settingsScreen/ModeResetRow'

interface ModeResetPageProps {
  readonly onResetCareer: (edition: CareerResetEdition) => void
  readonly careerResetBlockOf?: (edition: CareerResetEdition) => string | null
  readonly onResetEditedNames: () => void
  readonly onResetSeason?: () => void
  readonly mainMenu: { readonly gamePoint: number } | undefined
  /** 이번에 그리는 판 높이 — 첫 화면이 들고 있는 펼침(`nextPanelFold`) */
  readonly panelHeight: number
  /** 머리띠가 다 내려왔나 — 아니면 0x593c8 이 아무것도 안 그린다 (`SettingsScreen` 의 `isPageShown`) */
  readonly isPageShown: boolean
  readonly onBack: () => void
}

/**
 * 환경설정 → **모드 초기화** (메인 메뉴 상태 0x21 — 갱신 0x2c6d8 · 그리기 0x2dc00 → 0x593c8 종류 0x21 · 0x5a316 직접 읽음).
 *
 * 하위 상태 [this+0x18] (점프표 0xcece0) — 전부는 `entities/settings` 의 `modeReset` 머리글:
 * ```
 * 하위 0 목록    CLR(−16) → 0xbcb49(…, 8) 환경설정 첫 화면 · OK(−5) → 칸별
 *   칸 0 [82] 나만의리그  → 고르기 창 0xcf848 "초기화할 데이터를 선택하세요"(종류 0x10) → 하위 1
 *   칸 1 [83] 시즌모드    → 확인 0xcf870 (종류 2) + 0x749d5(창, 1) → 하위 3
 *   칸 2 [84] 에디트      → 확인 0xcf8d4 (종류 2) + 0x749d5(창, 1) → 하위 4
 * 하위 1 답 0 타자편 · 1 투수편 → 시즌 중 막기(0xb5054 && +0x4e) ? [212] / 투수편은 [213](원본 버그) 종류 1 → 하위 0
 *                                                         : [210] / [211] 종류 2 + 0x749d5(창, 1) → 하위 2 · −1 → 하위 0
 * 하위 2 답 0(예) → 하위 0 · 0x224ec(mgr, 타자편 4 / 투수편 3) · 알림 0xcf900 / 1·−1 → 하위 0
 * 하위 3 답 0(예) → 하위 0 · 0x224ec(mgr, 2) · 알림 0xcf900 "초기화 되었습니다" / 답 1·−1 → 하위 0
 * 하위 4 답 0(예) → 하위 0 · 0x204c1(mgr) = memset(이름표, 0, 0x708) · 알림 0xcf900 / 답 1·−1 → 하위 0
 * ```
 * 나리 칸은 그 편 저장이 있는지 안 본다 — 없어도 고르기·확인·지우기·알림이 다 돈다.
 * 파일 저장은 이 상태에 없다 — 환경설정 첫 화면을 CLR·OK 로 나갈 때 0x295e2 가 0x1f1b9 로 저장한다.
 * 웹 저장 고리들은 지우는 즉시 저장한다(웹 환경설정 값들도 바꾸는 즉시 저장한다) — 창을 닫아 버리는 경우만 다르다.
 *
 * 칸 1 시즌모드: 앱은 늘 `onResetSeason` 을 넘긴다(App.tsx → EntryRoutes) — 안 받는 시험 등에서만 OK 가 아무 일도 안 한다.
 */
export function ModeResetPage({
  onResetCareer,
  careerResetBlockOf,
  onResetEditedNames,
  onResetSeason,
  mainMenu,
  panelHeight,
  isPageShown,
  onBack,
}: ModeResetPageProps) {
  const [cursor, setCursor] = useState(0)
  const tick = useUpdateCounter()
  const isOutlineShown = isSelectedOutlineShown(useSkinBlinkCounter(tick))
  /** 고른 줄 까딱임 — 같은 표 0xd1784 · 0xd1754 (0x5a386~0x5a3cc) */
  const rowShake = useCursorShake(tick)
  const [popup, setPopup] = useState<ModeResetPopup | null>(null)
  const frames = useFrameOrigins(SLT_FRAMES)
  const titleFrames = useFrameOrigins(IMG_TEXT)
  const titlePalette = useImgTextPalette3()

  const openRow = (index: number) => {
    if (index === 0) return setPopup({ kind: '나리고르기' })
    if (index === 1) return onResetSeason === undefined ? undefined : setPopup({ kind: '시즌확인' })
    setPopup({ kind: '에디트확인' })
  }

  /** 하위 1 — 고르기 창 답. 막히면 [212]/[213] 알림 뒤 하위 0, 통과면 편별 확인 */
  const answerCareerChoose = (answer: number) => {
    if (answer !== 0 && answer !== 1) return setPopup(null)
    const edition: CareerResetEdition = answer === 0 ? '타자편' : '투수편'
    const blockText = careerResetBlockOf?.(edition) ?? null
    setPopup(blockText === null ? { kind: '나리확인', edition } : { kind: '나리막힘', text: blockText })
  }

  /** 확인 창 답 — 예(0)면 지우고 0xcf900 알림, 아니오는 하위 0 으로 */
  const answerConfirm = (reset: () => void) => (answer: number) => {
    if (answer !== 0) return setPopup(null)
    reset()
    setPopup({ kind: '완료' })
  }

  useEffect(() => {
    if (popup !== null) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      // 숫자키 꼴 1 격자 — '2' '8' '4' '6' '5' 를 ↑ ↓ ← → OK 로 (`gridKeyOf`)
      const key = gridKeyOf(event.key)
      // 격자가 바꾼 키를 0x5550d 에도 넘긴다(2958a · 288e4 · 2c706) — 화살표 꼴이면 [skin+0x8c] 에 남는다(Q-10)
      noteSkinShakeKey(key)
      const vertical = verticalStepOf(key)
      if (vertical !== 0) {
        event.preventDefault()
        // 0x21 진입 0x242a4 도 머리띠를 미끄러뜨린다 — 그동안은 +0x25 만 지워 까딱이지 않는다(0x5a772)
        if (!isFrameSlidingAt(tick)) rowShake.start(vertical > 0 ? 'down' : 'up')
        return setCursor((previous) => (previous + vertical + MODE_RESET_ROW_COUNT) % MODE_RESET_ROW_COUNT)
      }
      if (CONFIRM_KEYS.has(key)) {
        event.preventDefault()
        return openRow(cursor)
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
            {/* 제목 img_text 291 — 팔레트 3 (0x5a316~0x5a340 `0x913e5(img_text, 3)`) */}
            <FrameSprite
              folder={IMG_TEXT}
              frame={MODE_RESET_TITLE.frame}
              origins={titleFrames}
              x={MODE_RESET_TITLE.x}
              y={MODE_RESET_TITLE.y}
              style={titlePalette.style}
            />
            {MODE_RESET_NAMES.map((name, index) => (
              <ModeResetRow
                key={name}
                name={name}
                index={index}
                isSelected={index === cursor}
                isOutlineOn={index === cursor && isOutlineShown && isUnfolded}
                shift={index === cursor ? rowShake.offset : NO_SHIFT}
                frames={frames}
                onPress={(pressed) => {
                  setCursor(pressed)
                  openRow(pressed)
                }}
              />
            ))}
          </PanelClip>
        </>
      )}

      <SettingsFrame mainMenu={mainMenu} onBack={onBack} />

      <ModeResetPopups
        popup={popup}
        onResetCareer={onResetCareer}
        onResetEditedNames={onResetEditedNames}
        onResetSeason={onResetSeason}
        onCareerChoose={answerCareerChoose}
        answerConfirm={answerConfirm}
        onClose={() => setPopup(null)}
      />
    </RawScreen>
  )
}
