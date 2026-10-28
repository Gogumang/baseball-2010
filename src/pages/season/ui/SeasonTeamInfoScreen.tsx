import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { RawScreen, SpriteNumber, useImgTextPalettes } from '@/shared/ui'
import { useFrameOrigins } from '@/shared/lib/sprite/useFrameOrigins'
import { glyphsWidthOf, numberGlyphsOf } from '@/shared/lib/pixelNumber/pixelNumber'
import type { ImgTextPaletteIndex } from '@/shared/ui'
import { ORIGINAL_COLORS } from '@/shared/config/design'
import { SKIN_TICKER_CLIP_INSET, skinTickerTextXOf, useSkinTickerCounter } from '@/shared/lib/skinTicker/skinTicker'
import { useUpdateCounter } from '@/shared/lib/sprite/useUpdateCounter'
import { ScreenFrame } from '@/widgets/screen-frame/ui/ScreenFrame'
import { INFO_BOARD, INFO_ROW_HEIGHT, INFO_ROW_STEP, INFO_TOP } from '@/pages/management/lib/basicInfoLayout'
import { SeasonTeamCard } from '@/pages/season/ui/SeasonTeamCard'
import { TEAM_INFO_LEFT_ROWS } from '@/pages/season/lib/seasonTeamInfo'
import type { TeamInfoRow } from '@/pages/season/lib/seasonTeamInfo'
import * as styles from '@/pages/management/ui/ManagementScreen.css'
import { SkinBackdrop } from '@/pages/special/ui/SkinBackdrops'
import { assetUrl } from '@/shared/lib/assetUrl/assetUrl'

const IMG_TEXT = assetUrl('./sprites/img_text/frames')
const frameSrc = (frame: number) => `${IMG_TEXT}/${String(frame).padStart(3, '0')}.png`

/** mode_ui 프레임 3 박스 — 판 (21,176,197,83) · 이름표 1 (30,·,25) · 값 2 (60,·,81) · 이름표 3 (147,·,25) · 값 4 (176,·,32) */
const BOARD_WIDTH = 197
const COLUMNS = [
  { label: { x: 30, width: 25 }, value: { x: 60, width: 81 } },
  { label: { x: 147, width: 25 }, value: { x: 176, width: 32 } },
] as const

export interface SeasonTeamInfoScreenProps {
  readonly teamId: number
  /** 팀 레코드 +4 · +6 · +8 · +0xa — 팀 도형 0x5aefc 종류 0 */
  readonly teamAbilities: readonly number[]
  /** 정보 칸 일곱 줄 — `seasonTeamInfoRowsOf` */
  readonly rows: readonly TeamInfoRow[]
  readonly gamePoint?: number
  /** 딱지 [gfx+0x168] — 이 장면에서 팀 고르기 0xca · 트레이드 0xe4 를 거쳤는가 (`seasonPlayerCard.ts` 머리말) */
  readonly hasCardBadge?: boolean
  /** 0x4884 — 취소(−16) → 0xcd */
  readonly onBack: () => void
}

/**
 * 값 칸의 img_text 는 **팔레트 1(노랑)** 이다 — 좌석 "석" 345 (0x7c914 `0x913e5(img_text, 1)` → 0x7c944) ·
 * 타입 이름표 (0x7cca6 → 0x7ccd4). 이름표 일곱(0x7c592~0x7c696)은 그 앞에 팔레트 0 으로 찍는다(0x7c620 · 0x7c656).
 */
const VALUE_IMAGE_PALETTE: ImgTextPaletteIndex = 1
const LABEL_PALETTE: ImgTextPaletteIndex = 0

function valueOf(row: TeamInfoRow, styleOf: (frame: number, palette: ImgTextPaletteIndex) => CSSProperties | undefined) {
  const { value } = row
  if (value.kind === '그림') {
    return (
      <img
        alt=""
        data-frame={value.frame}
        src={frameSrc(value.frame)}
        style={{ verticalAlign: 'middle', ...styleOf(value.frame, VALUE_IMAGE_PALETTE) }}
      />
    )
  }
  // 숫자는 `NumberValue`(num 그림)가 그린다
  return value.kind === '숫자' ? null : value.text
}

/** num 그림 0 (프레임 20) 의 폭 — 0x7c8fe `[[num]+0x50]` vt+0x1c (`pixelNumber` 의 0 폭) */
const NUM_ZERO_WIDTH = 6

/** 0x6c805(v, 10) — 10 으로 나눈 몫이 0 이 아닌 동안 센 수 (자릿수 − 1, 0~9 는 0) */
function nonZeroQuotientsOf(value: number): number {
  let count = 0
  for (let rest = Math.trunc(value / 10); rest !== 0; rest = Math.trunc(rest / 10)) count += 1
  return count
}

/**
 * **숫자 값 칸** — 좌석(0x7c8c2~0x7c944) · 우승(0x7cdaa~0x7cdc4) · 순위(0x7ce88~0x7ceae) 모두
 * `0xba719(박스 xy, 박스 wh, 자간 1, 값, 기준 0x14, [gfx+0x13c] = ui/num, 정렬 0x22)` → numBox 0xba51c:
 * 주황 숫자 그림(num 20 + 숫자)을 칸 가운데 — 가로 (w − Σ(폭 + 1)) >> 1 · 세로 ceil((h − 10) / 2). 시스템 글꼴이 아니다.
 * 좌석 꼬리 img_text 345 "석"(팔레트 1)은 0xb9e05(…, 정렬 0x22, dx = r >> 1) — r = (0x6c805(값, 10) + 2) × (num 20 폭 + 2)
 * (0x7c8f2~0x7c930), 0xb9d74 가 x = 칸 x + dx + (w − 그림 폭) >> 1 · 세로 가운데로 놓는다.
 */
function NumberValue({
  value,
  suffixFrame,
  box,
  styleOf,
  sizeOf,
}: {
  readonly value: number
  readonly suffixFrame?: number
  readonly box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
  readonly styleOf: (frame: number, palette: ImgTextPaletteIndex) => CSSProperties | undefined
  readonly sizeOf: (frame: number) => { readonly width: number; readonly height: number } | undefined
}) {
  const glyphs = numberGlyphsOf(value)
  const total = glyphsWidthOf(glyphs)
  const right = box.x + ((box.width - total) >> 1) + total
  // 크기 표가 아직 없으면(첫 틀 · 시험) 0 으로 셈한다 — 표가 오면 다시 그린다
  const suffixSize = suffixFrame === undefined ? undefined : (sizeOf(suffixFrame) ?? { width: 0, height: 0 })
  const suffixDx = ((nonZeroQuotientsOf(value) + 2) * (NUM_ZERO_WIDTH + 2)) >> 1
  return (
    <>
      <SpriteNumber glyphs={glyphs} right={right} boxTop={box.y} boxHeight={box.height} />
      {suffixFrame !== undefined && suffixSize !== undefined && (
        <img
          className={styles.layer}
          alt=""
          data-frame={suffixFrame}
          src={frameSrc(suffixFrame)}
          style={{
            left: box.x + suffixDx + ((box.width - suffixSize.width) >> 1),
            top: box.y + Math.trunc((box.height - suffixSize.height + 1) / 2),
            ...styleOf(suffixFrame, VALUE_IMAGE_PALETTE),
          }}
        />
      )}
    </>
  )
}

/**
 * **구단정보 0xd5** — 카드 0x7ba44(로고 · 팀 이름 · ABILITY · 팀 도형) + 정보 칸 0x7c450(일곱 줄).
 * 값과 차례는 `pages/season/lib/seasonTeamInfo.ts` 머리 주석(직접 떴다).
 *
 * 카드 0x7ba44 의 0xd5 갈래 (직접 떴다):
 * ```
 * 0x76725([gfx+0x134])                      ; 계단형 판 — 들어옴 0x5324 가 0x76705([장면+0xc4], 0x67, 0x38, 0) (0x53c6~0x53d4)
 * 로고 [gfx+0x140] (W/2 − w/2 − 0x3e, H/2 − h/2 − 0x32) 0xba1d5(…, 0, 0, 0)   ; 0xd9 · 0xdc 밖이라 효과 0 (0x7bb20~0x7bb70)
 * [gfx+0x168] 이 있으면 로고 아래 · 위 딱지 — 팀 이름은 이 안에서만 그린다 (0x7bbca~0x7bdca, `SEASON_CARD_BADGE`)
 * mode_ui 8 (W/2 + 0x3a − w/2, H/2 − 0x6b) · img_text 159 (…, H/2 − 0x42 − 0x25)   ; 0x7bdce~0x7bea4
 * 0x5aefd(skin, W/2 + 0x3a, H/2 − 0x42 + 10, 종류 0, 팀 레코드, idx 0, 0x1e)    ; 0x7becc 상태 0xd5 → 0x7bf9c (리터럴 0x7c100)
 * ```
 * 0x5aefc 종류 0 은 ABILITY 판 전체(둥근 바탕 · 축 이름 상자 img_text 46 · 45 · 204 · 205 · 숫자)다 — `SeasonTeamCard` → `AbilityRadarPanel`.
 * 이름 입력 0xc8(그림 0xba28)도 같은 카드 갈래라 `SeasonTeamCard` 를 같이 쓴다.
 * 구장 줄은 흐르는 글 0x5a8c8 (`StadiumTicker`).
 */
export function SeasonTeamInfoScreen({ teamId, teamAbilities, rows, gamePoint = 0, hasCardBadge = false, onBack }: SeasonTeamInfoScreenProps) {
  const latestBack = useRef(onBack)
  latestBack.current = onBack
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' && event.key !== 'Backspace') return
      event.preventDefault()
      latestBack.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  return (
    <RawScreen>
      {/* 공통 앞그림 0xb810 — 0xd5 는 0xdd · 0xe0 · 0xe1 밖이라 공 무늬 0x5fd61(skin, 0, 0, W, H) 를 먼저 깐다 */}
      <SkinBackdrop kind="공무늬" />
      <div role="group" aria-label="구단정보">
        <SeasonTeamCard teamId={teamId} teamAbilities={teamAbilities} hasCardBadge={hasCardBadge} testIdPrefix="구단정보" />
        <SeasonTeamInfoPanel rows={rows} />
      </div>
      <ScreenFrame title="시즌모드" gamePoint={gamePoint} onBack={onBack} footer={5} slides={false} />
    </RawScreen>
  )
}

/**
 * **정보 칸 0x7c450 시즌 갈래**의 판과 일곱 줄 — 구단정보 0xd5 · 이름 입력 0xc8(그림 0xba28 의 ba5a) 이 같이 쓴다.
 * 이름 입력은 창+0x28 = 1 이라 줄 0 단장 값(0x7c6f4~0x7c724 `ldrb [gfx+0x28]` ≠ 0 → 건너뜀)을 안 쓴다 — 부르는 쪽이 빈 글로 넘긴다.
 */
export function SeasonTeamInfoPanel({ rows, testIdPrefix = '구단정보' }: { readonly rows: readonly TeamInfoRow[]; readonly testIdPrefix?: string }) {
  // 이름표 47 "순위" 는 팔레트 3 으로 구워 둔 프레임이라 팔레트 0 자리에서 흰 글자로 되돌린다
  const palettes = useImgTextPalettes()
  const origins = useFrameOrigins(IMG_TEXT)
  const sizeOf = (frame: number) => origins?.[String(frame).padStart(3, '0')]
  return (
    <>
      {palettes.definition}
      <div
        className={styles.layer}
        style={{ left: INFO_BOARD.x, top: INFO_BOARD.y, width: BOARD_WIDTH, height: INFO_BOARD.height, background: INFO_BOARD.color }}
      />
      {rows.map((row, index) => {
        const column = COLUMNS[index < TEAM_INFO_LEFT_ROWS ? 0 : 1]
        const top = INFO_TOP + (index < TEAM_INFO_LEFT_ROWS ? index : index - TEAM_INFO_LEFT_ROWS) * INFO_ROW_STEP
        // 구장 줄은 값 칸 너비가 w × 2 − 14 (0x7c9b2)
        const width = row.value.kind === '흐르는글' ? column.value.width * 2 - 14 : column.value.width
        return (
          <div key={row.labelFrame} data-testid={`${testIdPrefix}-줄-${index}`}>
            <img
              className={styles.layer}
              alt=""
              data-frame={row.labelFrame}
              src={frameSrc(row.labelFrame)}
              style={{
                left: column.label.x + column.label.width,
                top: top + 3,
                transform: 'translateX(-100%)',
                ...palettes.styleOf(row.labelFrame, LABEL_PALETTE),
              }}
            />
            {row.value.kind === '흐르는글' && (
              <StadiumTicker
                text={row.value.text}
                testId={`${testIdPrefix}-값-${index}`}
                box={{ x: column.value.x, y: top + 2, width, height: INFO_ROW_HEIGHT }}
              />
            )}
            {row.value.kind === '숫자' && (
              <div data-testid={`${testIdPrefix}-값-${index}`} data-value={row.value.value}>
                <NumberValue
                  value={row.value.value}
                  suffixFrame={row.value.suffixFrame}
                  styleOf={palettes.styleOf}
                  sizeOf={sizeOf}
                  box={{ x: column.value.x, y: top, width, height: INFO_ROW_HEIGHT }}
                />
              </div>
            )}
            {row.value.kind !== '흐르는글' && row.value.kind !== '숫자' && (
              <div
                className={styles.infoValue}
                data-testid={`${testIdPrefix}-값-${index}`}
                style={{ left: column.value.x, top, width, height: INFO_ROW_HEIGHT, color: ORIGINAL_COLORS.text }}
              >
                {valueOf(row, palettes.styleOf)}
              </div>
            )}
          </div>
        )
      })}
    </>
  )
}

/**
 * 구장 줄 0x7ca7e — `0x5a8c8(skin, 글, 상자 x, y + 2, w, h, 1, 1, 1)`: 자르기 (x + 2, y, w − 4, h) ·
 * 글 왼쪽 = x + w − [skin+0x284] % (글폭 + w) · 그린 뒤 3 올린다 (`shared/lib/skinTicker` — 앱에 하나인 카운터).
 */
function StadiumTicker({
  text,
  testId,
  box,
}: {
  readonly text: string
  readonly testId: string
  readonly box: { readonly x: number; readonly y: number; readonly width: number; readonly height: number }
}) {
  const tick = useUpdateCounter()
  const counter = useSkinTickerCounter(tick)
  const textRef = useRef<HTMLSpanElement>(null)
  const [textWidth, setTextWidth] = useState(0)
  useLayoutEffect(() => setTextWidth(textRef.current?.offsetWidth ?? 0), [text])
  const clipLeft = box.x + SKIN_TICKER_CLIP_INSET
  return (
    <div
      className={styles.layer}
      data-testid={testId}
      style={{
        left: clipLeft,
        top: box.y,
        width: box.width - SKIN_TICKER_CLIP_INSET * 2,
        height: box.height,
        overflow: 'hidden',
      }}
    >
      <span
        ref={textRef}
        className={styles.infoValue}
        style={{
          left: skinTickerTextXOf(box.x, box.width, counter, textWidth) - clipLeft,
          top: 0,
          width: 'auto',
          whiteSpace: 'nowrap',
          color: ORIGINAL_COLORS.text,
        }}
      >
        {text}
      </span>
    </div>
  )
}
