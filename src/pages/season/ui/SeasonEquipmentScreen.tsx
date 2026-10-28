import { useEffect, useRef, useState } from 'react'
import { FrameSprite, MessageBox, RawScreen, SpriteNumber } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { useTouchScrollKeys } from '@/shared/lib/touchKeyOffer/touchKeyOffer'
import { moneyGlyphsOf, numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import { FONT_SPACING, LINE_HEIGHT } from '@/shared/lib/font/layout'
import { PixelText } from '@/shared/ui/PixelText/PixelText'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonPlayerRecordView } from '@/entities/season-mode/model/seasonPlayerRecord'
import {
  SEASON_EQUIPMENT_LEVEL_COUNT,
  SEASON_EQUIPMENT_TEXT,
  applySeasonEquipment,
  checkSeasonEquipment,
} from '@/entities/season-mode/model/seasonEquipment'
import type { SeasonEquipmentApplied } from '@/entities/season-mode/model/seasonEquipment'
import { seasonCardAbilitiesOf } from '@/pages/season/lib/seasonPlayerDetail'
import { seasonCardLookOf } from '@/pages/season/lib/seasonPlayerCard'
import {
  EQUIPMENT_COLORS,
  EQUIPMENT_WINDOW,
  centeredOffsetOf,
  descriptionBoxRectsOf,
  effectOffsetsOf,
  equipmentDescriptionOf,
  equipmentEffectBonusOf,
  equipmentItemNameOf,
  equipmentPriceTenThousandsOf,
  isBlinkOn,
  moveEquipmentLevel,
  moveEquipmentPart,
  partMarkerBoxOf,
  partSeparatorRectsOf,
  scrollThumbRectsOf,
  scrolledEquipmentTopOf,
  tabPanelRectsOf,
  windowRowOf,
} from '@/pages/season/lib/seasonEquipmentWindow'
import type { WindowBox, WindowRect } from '@/pages/season/lib/seasonEquipmentWindow'
import { SeasonPlayerCard } from '@/pages/season/ui/SeasonPlayerCard'
import { fillModeText, seasonMoneyTextOf } from '@/widgets/season/lib/seasonText'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import * as styles from '@/widgets/season/ui/SeasonWindow.css'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const MODE_UI = assetUrl('./sprites/mode_ui/frames')
const IMG_TEXT = assetUrl('./sprites/img_text/frames')
const NUM = assetUrl('./sprites/num')
const imageOf = (folder: string, frame: number) => `${folder}/${String(frame).padStart(3, '0')}.png`
const pixel = { position: 'absolute', pointerEvents: 'none' } as const
/** num "+" 105 크기 */
const PLUS_SIZE = 6
/**
 * 설명 글 줄 간격 — 0xba411(박스 4, 글, 정렬 0x11, 5, 5) → 0xba2e4 가 글상자 0x6ecd0 으로 그려 **앱 전역 글꼴**(줄 11 + 줄간 3)이다.
 * 정렬 0x11 의 비트 0x1 · 0x10 은 0xba2e4 가 안 본다(0x2 · 0x4 · 0x20 · 0x40 만) — (x + 5, y + 5) 왼쪽 위 그대로.
 */
const TEXT_LINE = LINE_HEIGHT + FONT_SPACING.app.lineGap

const isCancelKey = (key: string) => key === 'Escape' || key === 'Backspace'
const isConfirmKey = (key: string) => key === 'Enter' || key === '5'
const modeText = (id: number) => ORIGINAL_MODE_TEXT[id] ?? ''

export interface SeasonEquipmentScreenProps {
  readonly record: SeasonRecord
  /** 사기 — 카드 레이더 실효값(0xb570c) */
  readonly teamMorale: number
  /** 들어올 때 뜬 선수 레코드 (0x5f3c — 0xb5694 의 0x30 바이트 사본) */
  readonly view: SeasonPlayerRecordView
  /** 팀 레코드 진짜 줄의 니블 네 칸 (+0x19 · +0x1a) */
  readonly equipment: readonly number[]
  /** B-23 고친 길 — 이 선수의 부위별 산 칸 비트 (`SeasonPlayer.ownedEquipment`) */
  readonly ownedEquipment?: readonly number[]
  /** 전역 해금표 app+0xc0 의 칸이 열렸나 (`seasonEquipmentHiddenIdOf`) */
  readonly isHiddenOpen: (id: number) => boolean
  readonly gamePoint?: number
  /** 0x7d90 결과 0x14 — 새 소지금(100만 원 단위)과 니블 네 칸 (B-23 고친 길이면 산 칸 비트도) */
  readonly onPurchase: (purchase: SeasonEquipmentApplied) => void
  /** 0x957c — 부위 목록에서 취소(−16) → 0xdf */
  readonly onBack: () => void
}

/** 0x81938(창, 부위, 칸) — 사본의 그 부위 니블 = 칸 + 1 (그림 vt+0x14 도 같은 칸) */
const withNibble = (nibbles: readonly number[], part: number, level: number) =>
  [0, 1, 2, 3].map((slot) => (slot === part ? level + 1 : (nibbles[slot] ?? 0)))

/**
 * **장비 창 0xdc (창 종류 3)** — 그림 0xb1f8: 창 0x8453c → 0x83378 · 카드 0x7ba44 · 선수 그림 · 머리띠 0x7f4ec.
 * 창 배치는 `lib/seasonEquipmentWindow.ts` 머리말(직접 떴다), 키 · 가드 · 적용은 `entities/season-mode/model/seasonEquipment.ts`.
 *
 * 키 (0x957c → 창 키 0x819ac 종류 3 갈래, 직접 떴다):
 * - 부위 목록([창+0x1a8] = 0): 취소 → 0xdf · 확인(−5 · '5') · 아래(−2 · '8') → 칸 목록(칸 커서 · 맨 윗줄 0) 으로 들어가며
 *   첫 칸을 그림에 끼워 본다(0x81c78 → 0x81938) · 그 밖은 부위 목록 4 열 × 1 줄을 감아 옮긴다(0x8146c 가 칸 목록을 다시 채운다).
 * - 칸 목록: 확인 → 가드 · 취소 → 부위 목록(칸 커서 · 맨 윗줄 0) 이고 그 부위를 **진짜 니블**로 되돌린다(0x81a9a) ·
 *   위 · 아래 → 1 열 × 11 줄을 감아 옮기고(깃발 0x30) 옮긴 칸을 끼워 본다(0x81bc4 → 0x81938).
 * 끼워 보기 0x81938 은 그림과 함께 카드 사본 [창+0x148] 의 니블도 바꾸므로 레이더 실효값(0xb570c)도 그 장비로 다시 셈한다.
 * 끼워 보기는 **사본만** 고친다(확정): 들어옴 0x5f3c 가 진짜 줄 0xb5695(팀, 0, 칸) 을 0x30 바이트 사본 [장면+0x118] 에 복사(0x6020~0x6040,
 * 0x1400408)하고 [창+0x148] = [장면+0x118](0x613c~0x614c) 로 둔다. 0x81938 은 [창+0x148] 니블 · 그림 · 레이더 애니 칸만 쓰고,
 * 취소(0x81a9a)는 0xb5695 로 진짜 줄 니블을 **읽어** 사본에 되쓴다 — 진짜 줄을 고치는 곳은 구매 적용 0x7d90 뿐이다(나리 0x108f8 과 같은 꼴).
 * 0x81938 이 레이더 애니([[skin+0xd4]+0x1e3] = 0)를 다시 거는 것은 카드 레이더의 `useRadarGrowth` 가 목표값이 바뀐 그림에서
 * 지난 목표값부터 새 값으로 오르내려 맞춘다.
 * 숫자 키: 종류 3 의 두 목록은 0x81792~0x817ba 가 vt+0x10(4, 1, **키 방식 1**, 0x30) · vt+0x1c(1, 11, 1, 0x30) 로 세우고, 격자 키
 * 0x6c030 의 방식 1 갈래(0x6c096 — 표 0xd2e7c)가 '2' → −1(위) · '4' → −3(왼) · '6' → −4(오른) · '8' → −2(아래) · '5' → −5 로
 * 바꿔 받는다(직접 떴다) — 방향키와 같은 걸음이다.
 */
export function SeasonEquipmentScreen({
  record,
  teamMorale,
  view,
  equipment,
  ownedEquipment,
  isHiddenOpen,
  gamePoint = 0,
  onPurchase,
  onBack,
}: SeasonEquipmentScreenProps) {
  const isBatter = !view.isPitcher
  // 카드 사본의 니블 — 들어올 때 진짜 줄의 사본(0x5f3c), 끼워 보기 · 되돌리기가 바꾼다
  const [cardNibbles, setCardNibbles] = useState<readonly number[]>(equipment)
  const [part, setPart] = useState(0)
  const [level, setLevel] = useState(0)
  const [top, setTop] = useState(0)
  const [isItemFocus, setItemFocus] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [question, setQuestion] = useState<{ readonly text: string } | null>(null)
  const tick = useUpdateCounter()

  const select = () => {
    const checked = checkSeasonEquipment(record, { isBatter, equipment, ownedEquipment }, part, level, isHiddenOpen)
    if (!checked.ok) {
      const text = modeText(SEASON_EQUIPMENT_TEXT[checked.reason])
      setNotice(checked.reason === '인기도부족' ? fillModeText(text, checked.required ?? 0) : text)
      return
    }
    // B-23 고친 길 — 산 적 있는 칸은 확인 창 없이 곧장 끼운다(StrMODE[142] 장착 완료)
    if (checked.owned === true) return buy()
    setQuestion({ text: fillModeText(modeText(SEASON_EQUIPMENT_TEXT.구매확인), seasonMoneyTextOf(checked.price * 10)) })
  }

  const buy = () => {
    setQuestion(null)
    onPurchase(applySeasonEquipment(record.money, { isBatter, equipment, ownedEquipment }, part, level))
    setNotice(modeText(SEASON_EQUIPMENT_TEXT.장착완료))
  }

  const enterItems = (target: number) => {
    setItemFocus(true)
    setLevel(0)
    setTop(0)
    setCardNibbles((held) => withNibble(held, target, 0))
  }

  const leaveItems = () => {
    setItemFocus(false)
    setLevel(0)
    setTop(0)
    setCardNibbles((held) => withNibble(held, part, (equipment[part] ?? 0) - 1))
  }

  const moveLevel = (step: -1 | 1) => {
    const next = moveEquipmentLevel(level, step)
    setLevel(next)
    setTop((held) => scrolledEquipmentTopOf(held, next))
    setCardNibbles((held) => withNibble(held, part, next))
  }

  const latest = useRef({ isItemFocus, part, select, enterItems, leaveItems, moveLevel, onBack, isPopup: false })
  latest.current = { isItemFocus, part, select, enterItems, leaveItems, moveLevel, onBack, isPopup: notice !== null || question !== null }
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const current = latest.current
      if (current.isPopup) return
      const key = event.key
      if (!current.isItemFocus) {
        if (isCancelKey(key)) current.onBack()
        else if (isConfirmKey(key) || key === 'ArrowDown' || key === '8') current.enterItems(current.part)
        else if (key === 'ArrowLeft' || key === '4') setPart((held) => moveEquipmentPart(held, -1))
        else if (key === 'ArrowRight' || key === '6') setPart((held) => moveEquipmentPart(held, 1))
        else return
      } else if (isCancelKey(key)) current.leaveItems()
      else if (isConfirmKey(key)) current.select()
      else if (key === 'ArrowUp' || key === '2') current.moveLevel(-1)
      else if (key === 'ArrowDown' || key === '8') current.moveLevel(1)
      else return
      event.preventDefault()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // 터치 기기 — 레벨 목록(11칸 중 5줄만 보인다)에 들어가 있으면 ▲ · ▼ 상황 버튼(↑ · ↓ 키 사건). 보이는 줄은 눌러서 고른다
  useTouchScrollKeys(isItemFocus && notice === null && question === null)

  const cardView = { ...view, equipment: cardNibbles }
  const abilities = seasonCardAbilitiesOf(cardView, { record, teamMorale })

  return (
    <RawScreen>
      {/* 공통 앞그림 0xb810 — 0xdc 는 0xdd · 0xe0 · 0xe1 밖이라 공 무늬 0x5fd61(skin, 0, 0, W, H) 를 먼저 깐다 */}
      <SkinBackdrop kind="공무늬" />
      <div role="group" aria-label={`장비 ${view.name}`} data-testid="장비-창" data-nibbles={cardNibbles.join(',')}>
        <EquipmentWindow
          record={record}
          isBatter={isBatter}
          equipment={equipment}
          part={part}
          level={level}
          top={top}
          isItemFocus={isItemFocus}
          tick={tick}
          isHiddenOpen={isHiddenOpen}
          onPickPart={(slot) => {
            if (notice !== null || question !== null) return
            // ⚠️ 웹 전용 길(원본은 칸 목록에서 부위로 가려면 취소 0x81a9a 를 거친다) — 칸 목록에서 다른 부위를 누르면
            // 먼저 지금 부위를 진짜 니블로 되돌린다. 안 그러면 앞 부위에 끼워 본 장비가 카드 사본에 남았다(r263)
            if (isItemFocus) leaveItems()
            setPart(slot)
            enterItems(slot)
          }}
          onPickLevel={(slot) => {
            if (!isItemFocus) return
            if (slot === level) select()
            else {
              setLevel(slot)
              setCardNibbles((held) => withNibble(held, part, slot))
            }
          }}
        />
      </div>
      <SeasonPlayerCard
        teamId={record.teamId}
        isPitcher={view.isPitcher}
        look={seasonCardLookOf(cardView, record.teamId)}
        abilities={abilities}
        isAnimating
      />
      <ScreenFrame title="시즌모드" gamePoint={gamePoint} onBack={isItemFocus ? leaveItems : onBack} footer={5} slides={false} />

      {question !== null && (
        <MessageBox text={question.text} buttons={['예', '아니오']} onAnswer={(index) => (index === 0 ? buy() : setQuestion(null))} />
      )}
      {question === null && notice !== null && <MessageBox text={notice} buttons={['OK']} onAnswer={() => setNotice(null)} />}
    </RawScreen>
  )
}

function Rects({ rects, testId }: { readonly rects: readonly WindowRect[]; readonly testId?: string }) {
  return (
    <svg viewBox="0 0 240 320" shapeRendering="crispEdges" data-testid={testId} style={{ ...pixel, left: 0, top: 0, width: 240, height: 320 }}>
      {rects.map((rect, index) => (
        <rect key={index} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={rect.color} />
      ))}
    </svg>
  )
}

/** 정렬 0x24 — 오른쪽(ox) · 세로 가운데 */
function RightImage({
  src,
  box,
  width,
  height,
  ox,
  oy = 0,
}: {
  readonly src: string
  readonly box: WindowBox
  readonly width: number
  readonly height: number
  readonly ox: number
  readonly oy?: number
}) {
  return <img alt="" src={src} style={{ ...pixel, left: box.x + box.width - width + ox, top: box.y + centeredOffsetOf(box.height, height) + oy }} />
}

function EquipmentWindow({
  record,
  isBatter,
  equipment,
  part,
  level,
  top,
  isItemFocus,
  tick,
  isHiddenOpen,
  onPickPart,
  onPickLevel,
}: {
  readonly record: SeasonRecord
  readonly isBatter: boolean
  readonly equipment: readonly number[]
  readonly part: number
  readonly level: number
  readonly top: number
  readonly isItemFocus: boolean
  readonly tick: number
  readonly isHiddenOpen: (id: number) => boolean
  readonly onPickPart: (part: number) => void
  readonly onPickLevel: (level: number) => void
}) {
  const uiOrigins = useFrameOrigins(MODE_UI)
  const textOrigins = useFrameOrigins(IMG_TEXT)
  const sizeOf = (frame: number) => textOrigins?.[String(frame).padStart(3, '0')]
  const { labels, values, items, description } = EQUIPMENT_WINDOW
  const valueRight = values.x + values.width - EQUIPMENT_WINDOW.valueInset
  const marker = partMarkerBoxOf(part)
  const markerOrigin = uiOrigins?.[String(EQUIPMENT_WINDOW.partMarkerFrame).padStart(3, '0')]
  const visible = Array.from({ length: EQUIPMENT_WINDOW.visibleRows }, (_unused, row) => top + row).filter(
    (index) => index < SEASON_EQUIPMENT_LEVEL_COUNT,
  )
  const bonus = equipmentEffectBonusOf(level)
  const effectOffsets = effectOffsetsOf(bonus)
  const effectLabel = EQUIPMENT_WINDOW.effectLabelBase[isBatter ? '타자' : '투수'] + part
  const effectLabelSize = sizeOf(effectLabel)
  const effectRow = windowRowOf(values, 2)
  const descriptionText = isItemFocus ? equipmentDescriptionOf(isBatter, part, level, isHiddenOpen) : null

  return (
    <>
      <Rects rects={[...tabPanelRectsOf(EQUIPMENT_WINDOW.panel, true), ...partSeparatorRectsOf(), ...descriptionBoxRectsOf()]} testId="장비-판" />
      <FrameSprite folder={MODE_UI} frame={EQUIPMENT_WINDOW.frame} origins={uiOrigins} x={0} y={0} />
      {EQUIPMENT_WINDOW.labelFrames.map((frame, row) => {
        const size = sizeOf(frame)
        return size === undefined ? null : (
          <RightImage
            key={frame}
            src={imageOf(IMG_TEXT, frame)}
            box={windowRowOf(labels, row)}
            width={size.width}
            height={size.height}
            ox={-EQUIPMENT_WINDOW.valueInset}
          />
        )
      })}
      <div data-testid="장비-소지금" aria-label={String(record.money * 100)}>
        <SpriteNumber glyphs={moneyGlyphsOf(record.money * 100)} right={valueRight} boxTop={values.y} boxHeight={values.height} />
      </div>
      {/* 부위 표시 — 부위 목록에 있을 때는 틱 % 10 == 0 에 꺼진다 */}
      {(isItemFocus || isBlinkOn(tick)) && markerOrigin !== undefined && (
        <img
          alt=""
          data-testid="장비-부위표시"
          data-part={part}
          src={imageOf(MODE_UI, EQUIPMENT_WINDOW.partMarkerFrame)}
          style={{
            ...pixel,
            left: marker.x + centeredOffsetOf(marker.width, markerOrigin.width),
            top: marker.y + centeredOffsetOf(marker.height, markerOrigin.height),
          }}
        />
      )}
      {[0, 1, 2, 3].map((slot) => {
        const box = partMarkerBoxOf(slot)
        return (
          <button
            key={slot}
            type="button"
            aria-label={`부위 ${slot + 1}`}
            aria-current={slot === part}
            style={{
              position: 'absolute',
              left: box.x,
              top: box.y,
              width: box.width,
              height: box.height,
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
            }}
            onClick={() => onPickPart(slot)}
          />
        )
      })}
      {visible.map((index, row) => {
        const box = windowRowOf(items, row)
        const isEquipped = (equipment[part] ?? 0) - 1 === index
        const isCursor = isItemFocus && index === level
        const name = equipmentItemNameOf(isBatter, part, index, isHiddenOpen)
        return (
          <div key={index} data-testid={`장비-칸-${index}`}>
            {isEquipped && <img alt="" src={imageOf(MODE_UI, EQUIPMENT_WINDOW.equippedBarFrame)} style={{ ...pixel, left: box.x, top: box.y }} />}
            <button
              type="button"
              className={styles.title}
              aria-label={name}
              aria-current={isCursor}
              style={{
                left: box.x,
                top: box.y,
                width: box.width,
                height: box.height,
                lineHeight: `${box.height}px`,
                color: isEquipped ? EQUIPMENT_COLORS.equippedText : EQUIPMENT_COLORS.itemText,
                pointerEvents: 'auto',
                background: 'transparent',
                border: 'none',
                padding: 0,
                cursor: 'pointer',
              }}
              onClick={() => onPickLevel(index)}
            >
              {name}
            </button>
            {/* 0xb9ed5 → 0x6a978 은 폭 · 높이에 1 을 더해 (w + 1) × (h + 1) 칸을 덮는다 (U-113, R12 6절) */}
            {isCursor && isBlinkOn(tick) && (
              <div
                data-testid="장비-커서"
                style={{
                  ...pixel,
                  left: box.x,
                  top: box.y,
                  width: box.width + 1,
                  height: box.height + 1,
                  boxSizing: 'border-box',
                  border: `1px solid ${EQUIPMENT_COLORS.cursor}`,
                }}
              />
            )}
          </div>
        )
      })}
      {isItemFocus && (
        <>
          <div data-testid="장비-가격" aria-label={String(equipmentPriceTenThousandsOf(isBatter, part, level))}>
            <SpriteNumber
              glyphs={moneyGlyphsOf(equipmentPriceTenThousandsOf(isBatter, part, level))}
              right={valueRight}
              boxTop={windowRowOf(values, 1).y}
              boxHeight={values.height}
            />
          </div>
          <div data-testid="장비-효과" aria-label={`+${bonus}`}>
            {effectLabelSize !== undefined && (
              <RightImage
                src={imageOf(IMG_TEXT, effectLabel)}
                box={effectRow}
                width={effectLabelSize.width}
                height={effectLabelSize.height}
                ox={effectOffsets.label}
              />
            )}
            <RightImage
              src={imageOf(NUM, EQUIPMENT_WINDOW.plusFrame)}
              box={effectRow}
              width={PLUS_SIZE}
              height={PLUS_SIZE}
              ox={effectOffsets.plus}
              oy={1}
            />
            <SpriteNumber glyphs={numberGlyphsOf(bonus)} right={valueRight} boxTop={effectRow.y} boxHeight={values.height} />
          </div>
          {descriptionText !== null && (
            <div data-testid="장비-설명" aria-label={descriptionText.replaceAll('!N', '\n')}>
              {descriptionText.split('!N').map((line, index) => (
                <PixelText
                  key={index}
                  style={{
                    ...pixel,
                    left: description.x + EQUIPMENT_WINDOW.descriptionInset,
                    top: description.y + EQUIPMENT_WINDOW.descriptionInset + index * TEXT_LINE,
                    color: EQUIPMENT_COLORS.cursor,
                  }}
                >
                  {line}
                </PixelText>
              ))}
            </div>
          )}
        </>
      )}
      <Rects rects={scrollThumbRectsOf(top)} testId="장비-굴림" />
    </>
  )
}
