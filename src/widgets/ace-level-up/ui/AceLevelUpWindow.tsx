import { useEffect, useState } from 'react'
import { CommonPanel, FrameSprite, InsetBox, MessageBox, useImgTextPalette3 } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { parseGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'
import { ACE_OPEN_TABLE } from '@/shared/config/original/aceOpen'
import { emitMenuSparkle } from '@/widgets/particles/model/sceneParticles'
import {
  ACE_LEVEL_UP_TEXT,
  aceLevelUpOutcomeOf,
  aceLevelUpRowsOf,
} from '@/entities/mission/model/aceLevel'
import {
  ACE_BATTER_ROW_LABEL_FRAMES, ACE_LEVEL_UP_ARROW_IMAGE, ACE_LEVEL_UP_BAR_FRAME, ACE_LEVEL_UP_BUTTONS, ACE_LEVEL_UP_BUTTON_SIZE,
  ACE_LEVEL_UP_COST_BOX, ACE_LEVEL_UP_COST_TEXT, ACE_LEVEL_UP_HEAD, ACE_LEVEL_UP_PANEL, ACE_LEVEL_UP_TIMES_FRAME, ACE_LEVEL_UP_TITLE,
  ACE_PITCHER_ROW_LABEL_FRAMES, aceLevelUpNumberOf, aceLevelUpRowOf,
} from '@/widgets/ace-level-up/lib/aceLevelUpLayout'
import type { AceLevelUpGlyph } from '@/widgets/ace-level-up/lib/aceLevelUpLayout'
import * as styles from '@/widgets/ace-level-up/ui/AceLevelUpWindow.css'

const IMG_TEXT = './sprites/img_text/frames'
const SLT_FRAME = './sprites/slt_frame/frames'
const SLT_IMAGE = './sprites/slt_frame'
const POPUP = './sprites/popup/frames'
const NUM = './sprites/num'
const pad = (frame: number) => String(frame).padStart(3, '0')

/** 마투수/마타자 구분 — 창 그리기 0x5f4be `cmp idx,#4; bgt` (칸 0~4 마투수) */
const LAST_PITCHER_CELL = 4

export interface AceLevelUpWindowProps {
  /** 고른 마선수 칸 0~9 (`skin+0x31d`) */
  readonly cell: number
  /** 그 칸의 지금 레벨 0~3 — 최고 레벨이면 부르는 쪽이 창을 열지 않는다 (0x2b0e0) */
  readonly level: number
  /** 들고 있는 G (`mgr[+0x64]`) */
  readonly gamePoint: number
  /** 레벨업 확정 — 받는 쪽이 레벨을 올리고 G를 뺀다 (0x5fbee · 0x5fc0a). 창은 이 뒤 닫힌다 */
  readonly onLevelUp: (cell: number, cost: number) => void
  /** 창 닫기 0x5faf4 */
  readonly onClose: () => void
}

/**
 * **마선수 레벨업 창** — 그리기 `0x5f394` · 키 `0x5fb24` (S9 1·2-1 절, 이번에 키 쪽을 다시 디스어셈해 확인).
 *
 * 키 (0x5fb68~0x5fb94):
 * ```
 * −5(OK) · '5'           → 레벨업 시도 (커서가 "아니오" 면 그냥 닫기, 0x5fb9e)
 * −4 · −3 · '4' · '6'    → 예 ↔ 아니오 (0x5fc80). S9 가 적은 −2·−1·0·1·2 는 **아무 일도 없다**
 *                          (0x5fb68 `adds r2,r4,#3; bgt` 뒤 비교 줄에 그 값이 없다)
 * −16(CLR) · '0'         → 닫기 0x5faf4
 * ```
 * 레벨업 시도는 `aceLevelUpOutcomeOf` — G가 모자라면 0xcc214 팝업을 띄우고 **창은 열린 채** 하위 단계
 * +0x314 = 1 이다. 팝업 "아니오" 는 팝업만 닫는다 (0x5fcaa). "예" 는 원본에서 G 충전 페이지(상태 24)로
 * 나간다(0x2af56 → 0x2b25a) — ⚠️ 웹판엔 통신 충전 화면이 없어 "아니오" 와 같이 팝업만 닫는다 (근사).
 *
 * 창 안 (0x5f394 — 배치는 `aceLevelUpLayout` 머리말): 공용 판(제목 탭 · 어둡게) · 제목 img_text 375 "레벨업" 팔레트 3 ·
 * 머리 줄 "LV" 지금 → 다음 · 다섯 줄 = 능력치 네 칸의 지금 값 → 다음 레벨 값(배율 사본 0xd1734) + 필살타법/마구 횟수
 * (0xd1739/0xd173e) · 안쪽 칸에 비용 줄 StrCOMMON[49] · popup.pzx 예/아니오 그림.
 *
 * **성공 길 (0x5fbec~0x5fc74, 직접 떴다)**:
 * ```
 * 5fbee  mgr[0x13a + 칸] = 레벨 + 1
 * 5fbf0  G = clamp(G − 비용, 0, 99999) → mgr+0x64 · 0x1f1b9 저장 · 0x22c29(통계, 0, 비용) · 0x1f1e1
 * 5fc5c  0xbbc85(W/2 − 0x3c, H/2, id 2, 그림 4, 0, −1, 0, 0)   ; ptc/003.ptc 반짝이를 (60, 160) 에
 * 5fc64  0x5faf4(창, 0) 닫기 · [skin+0xd4]+0x1e3 = 0           ; 레이더 객체 도형 다시 만들기
 * ```
 * 성공 연출은 이 파티클 하나뿐이다. *(정정 2026-10-16)* 예전 주석은 "메인 메뉴 장면 0x103 은 관리자를 돌리지 않는다" 고 적었으나
 * **틀렸다** — 관리자 틱 0x6de85 · 그리기 0x6dd69 를 부르는 0x32dd8 이 바로 0x103 의 그리기 스위치다(프레임 0x32fa0 이 32fe6 에서
 * 그림마다 부르고, 모든 상태가 32f34 로 모여 32f48~32f5a 에서 파티클을 굴리고 그린다). 시즌 0x105(0xe9ac) · 나리 0x106(0x1cdec) ·
 * 미션 선택 0x107(0x1eb0c) · 경기 0x104(0x52c50)도 돈다. 그래서 성공한 그 그림부터 (60, 160) 에서 반짝인다 — 장면 관리자
 * (`widgets/particles` 의 `emitMenuSparkle` · `SceneParticleLayer`)에 쏜다. 레이더 다시 만들기는 이 장면에 레이더가 없어 보이는 것이 없다.
 */
export function AceLevelUpWindow({ cell, level, gamePoint, onLevelUp, onClose }: AceLevelUpWindowProps) {
  /** `skin+0x31e` — 1 = "예" 가 기본 (0x5faf4 가 1 로 되돌린다) */
  const [isYes, setIsYes] = useState(true)
  /** 하위 단계 +0x314 = 1 — G 부족 팝업이 떠 있다 */
  const [isShortageOpen, setIsShortageOpen] = useState(false)

  const entry = ACE_OPEN_TABLE[cell]
  const role = cell <= LAST_PITCHER_CELL ? '투수' : '타자'
  const outcome = aceLevelUpOutcomeOf(level, gamePoint)
  const rows = entry === undefined ? [] : aceLevelUpRowsOf(role, entry.ability, level)

  const confirm = () => {
    if (!isYes) return onClose()
    if (outcome.kind === 'G부족') return setIsShortageOpen(true)
    onLevelUp(cell, outcome.cost)
    // 5fc5c — (60, 160) 에 ptc/003 반짝이, 이어 5fc64 닫기
    emitMenuSparkle()
    onClose()
  }

  useEffect(() => {
    if (isShortageOpen) return undefined
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === '4' || event.key === '6') {
        event.preventDefault()
        event.stopImmediatePropagation()
        return setIsYes((previous) => !previous)
      }
      if (event.key === 'Enter' || event.key === '5') {
        event.preventDefault()
        event.stopImmediatePropagation()
        return confirm()
      }
      if (event.key === 'Escape' || event.key === 'Backspace' || event.key === '0') {
        event.preventDefault()
        event.stopImmediatePropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const textOrigins = useFrameOrigins(IMG_TEXT)
  const sltOrigins = useFrameOrigins(SLT_FRAME)
  const popupOrigins = useFrameOrigins(POPUP)
  const palette3 = useImgTextPalette3()
  const widthOf = (frame: number) => textOrigins?.[pad(frame)]?.width ?? 0
  const labelFrames = role === '투수' ? ACE_PITCHER_ROW_LABEL_FRAMES : ACE_BATTER_ROW_LABEL_FRAMES
  const numberImages = (glyphs: readonly AceLevelUpGlyph[], key: string) => glyphs.map((glyph, index) => (
    <img key={`${key}-${index}`} className={styles.layer} alt="" src={`${NUM}/${pad(glyph.image)}.png`}
      style={{ left: glyph.x, top: glyph.y }} />
  ))
  const textLine = (frame: number, left: number, top: number, key?: string) => (
    <img key={key} className={styles.layer} alt="" src={`${IMG_TEXT}/${pad(frame)}.png`} style={{ left, top }} />
  )
  const head = ACE_LEVEL_UP_HEAD
  const costLines = parseGameMarkup(ACE_LEVEL_UP_TEXT.confirm.replace('%d', String(outcome.cost)))

  return (
    <>
      <div role="dialog" aria-label="마선수 레벨업" data-cell={cell}>
        {palette3.definition}
        {/* 5f424 공용 판 0x55e60(skin, W/2, H/2, 0xc0, 0xd4, 0, 0x22, 0, 0, 제목 탭 1, 어둡게 1) */}
        <CommonPanel x={ACE_LEVEL_UP_PANEL.x} y={ACE_LEVEL_UP_PANEL.y} width={ACE_LEVEL_UP_PANEL.width}
          height={ACE_LEVEL_UP_PANEL.height} titleTab dim testId="레벨업-판" />
        <img className={styles.layer} alt="레벨업" src={`${IMG_TEXT}/${pad(ACE_LEVEL_UP_TITLE.frame)}.png`}
          style={{ left: ACE_LEVEL_UP_TITLE.centerX - (widthOf(ACE_LEVEL_UP_TITLE.frame) >> 1), top: ACE_LEVEL_UP_TITLE.y, ...palette3.style }} />

        {/* 머리 줄 — LV 지금 → 다음 */}
        <FrameSprite folder={SLT_FRAME} frame={ACE_LEVEL_UP_BAR_FRAME} origins={sltOrigins} x={head.bar.x} y={head.bar.y} />
        <img className={styles.layer} alt="" src={`${SLT_IMAGE}/${pad(ACE_LEVEL_UP_ARROW_IMAGE)}.png`}
          style={{ left: head.arrow.x, top: head.arrow.y }} />
        {textLine(head.labelFrame, head.labelRight - widthOf(head.labelFrame), head.labelY)}
        <span data-testid="레벨업-레벨" aria-label={`LV ${level + 1} → ${level + 2}`}>
          {numberImages(aceLevelUpNumberOf(level + 1, head.currentCenterX, head.numberY, 2), 'lv-now')}
          {numberImages(aceLevelUpNumberOf(level + 2, head.nextCenterX, head.numberY, 2), 'lv-next')}
        </span>

        {rows.map((row, index) => {
          const place = aceLevelUpRowOf(index)
          const labelFrame = labelFrames[index] ?? 0
          return (
            <div key={row.label} data-testid="레벨업-줄" aria-label={`${row.label} ${row.current} → ${row.next}`}>
              <FrameSprite folder={SLT_FRAME} frame={ACE_LEVEL_UP_BAR_FRAME} origins={sltOrigins} x={place.currentBar.x} y={place.currentBar.y} />
              <img className={styles.layer} alt="" src={`${SLT_IMAGE}/${pad(ACE_LEVEL_UP_ARROW_IMAGE)}.png`}
                style={{ left: place.arrow.x, top: place.arrow.y }} />
              <FrameSprite folder={SLT_FRAME} frame={ACE_LEVEL_UP_BAR_FRAME} origins={sltOrigins} x={place.nextBar.x} y={place.nextBar.y} />
              {textLine(labelFrame, place.labelRight - widthOf(labelFrame), place.labelY)}
              {place.times.map((spot, spotIndex) => textLine(ACE_LEVEL_UP_TIMES_FRAME, spot.x, spot.y, `times-${spotIndex}`))}
              {numberImages(aceLevelUpNumberOf(row.current, place.currentRight, place.numberY, 4), 'now')}
              {numberImages(aceLevelUpNumberOf(row.next, place.nextRight, place.numberY, 4), 'next')}
            </div>
          )
        })}

        {/* 5f878 안쪽 칸 · 5f8de 비용 줄 0xba269(…, (38, 196), 폭 164) */}
        <InsetBox x={ACE_LEVEL_UP_COST_BOX.x} y={ACE_LEVEL_UP_COST_BOX.y} width={ACE_LEVEL_UP_COST_BOX.width}
          height={ACE_LEVEL_UP_COST_BOX.height} testId="레벨업-비용-칸" />
        <div className={styles.cost} data-testid="레벨업-비용"
          style={{ left: ACE_LEVEL_UP_COST_TEXT.x, top: ACE_LEVEL_UP_COST_TEXT.y, width: ACE_LEVEL_UP_COST_TEXT.width }}>
          {costLines.map((line, lineIndex) => (
            <div key={lineIndex} style={{ textAlign: line.isCentered ? 'center' : 'left' }}>
              {line.segments.map((segment, segmentIndex) => (
                <span key={segmentIndex} style={segment.color === null ? undefined : { color: segment.color }}>{segment.text}</span>
              ))}
            </div>
          ))}
        </div>

        {/* 5f948 · 5f97c popup 1 "예" · 2 "아니오" — 고른 칸은 6 · 7 을 덧긋는다 (5f9f6) */}
        {ACE_LEVEL_UP_BUTTONS.map((button, index) => {
          const isSelected = (index === 0) === isYes
          return (
            <span key={button.label}>
              <FrameSprite folder={POPUP} frame={button.frame} origins={popupOrigins} x={button.x} y={button.y} />
              {isSelected && (
                <FrameSprite folder={POPUP} frame={button.selectedFrame} origins={popupOrigins} x={button.x} y={button.y} />
              )}
              <button type="button" className={styles.hitArea} aria-label={button.label} aria-pressed={isSelected}
                style={{ left: button.x, top: button.y, width: ACE_LEVEL_UP_BUTTON_SIZE.width, height: ACE_LEVEL_UP_BUTTON_SIZE.height }}
                onClick={() => (index === 0 ? (isYes ? confirm() : setIsYes(true)) : onClose())} />
            </span>
          )
        })}
      </div>
      {isShortageOpen && (
        <MessageBox
          text={ACE_LEVEL_UP_TEXT.shortage}
          buttons={['예', '아니오']}
          onAnswer={() => setIsShortageOpen(false)}
        />
      )}
    </>
  )
}
