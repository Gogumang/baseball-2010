import {
  BATTER_BOXES, BATTER_CARD_FRAME, CARD_COLORS, GAME_UI_FOLDER, GAME_UI_FRAMES, IMG_TEXT_FOLDER, IMG_TEXT_FRAMES, LABEL,
  NUMBER_BASE, NUM_FOLDER, PITCHER_BOXES, PITCHER_CARD_FRAME,
  batterPositionBadgeOf, battingAverageGlyphsOf, boxNumberGlyphsOf, cardBackgroundOf, cardOriginsAt,
  earnedRunAverageGlyphsOf, framePlacementOf, pitcherRoleBadgeOf, recentResultChipsOf, staminaGaugeRectsOf,
} from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import type {
  CardBox, FillRect, FrameSize, NumberGlyph, Placed, StaminaGauge,
} from '@/widgets/matchup-cards/lib/matchupCardsLayout'
import * as styles from '@/widgets/matchup-cards/ui/MatchupCards.css'

/**
 * 투수 판에 적을 것. 값을 모르면 비워 둔다 — 그 칸은 안 그린다(원본은 늘 그린다 — 부르는 쪽이 값을 못 대는 칸이다).
 */
export interface MatchupPitcherCard {
  /** `0xb6c20(st, st[0xa]) == 1` — 수비 팀이 COM 이면 img_text 158, 아니면 157 PLAYER */
  readonly isComputer: boolean
  /** 0xb62c0(투수) */
  readonly name?: string
  /** 0xb6704 = 레코드 +0xb & 3 (0 선발 · 1 중계 · 2 구원) */
  readonly role?: number
  /** 0xb63c0(투수) — 참이면 54 좌완, 아니면 55 우완 */
  readonly throwsLeft?: boolean
  /** 0xb6ce8 — 방어율 × 100 (0~9999) */
  readonly earnedRunAverage?: number
  /** 레코드 +0x26 (s16) */
  readonly strikeouts?: number
  readonly stamina?: StaminaGauge
}

/** 타자 판에 적을 것 */
export interface MatchupBatterCard {
  /** `0xb6c20(st, st[9]) == 1` */
  readonly isComputer: boolean
  /** 0xb62c0(타자) */
  readonly name?: string
  /** 레코드 +0x1c & 0xf (0x54590) */
  readonly position?: number
  /** 0xb8e3c — 타율 × 1000 (0~1000) */
  readonly battingAverage?: number
  /** 레코드 +0x28 (s16) */
  readonly homeRuns?: number
  /** 레코드 +0x2a (s16) */
  readonly runsBattedIn?: number
  /** 팀 +0x32 (0 부터) — 판에는 + 1 */
  readonly battingOrder?: number
  /** 오늘 타석 기록 코드를 오래된 차례로 (0x53100(칸, i), i = 0..칸+0xc−1) */
  readonly recentResults?: readonly number[]
}

interface MatchupCardsProps {
  /** 상태 0xe 의 틱 [장면+0x2c] — 들어선 그림이 0 */
  readonly tick: number
  /** 0xb63c0(지금 타자) — 1 좌타 · 0 우타. 타자 판의 좌타/우타 글자도 이것이다 */
  readonly batterHand: number
  /** 장면 +0x17e1. 안 넘기면 `batterHand` (적재 8 이 같은 0xb63c0 으로 넣는다) */
  readonly side?: number
  readonly pitcher: MatchupPitcherCard
  readonly batter: MatchupBatterCard
}

const pad = (frame: number) => String(frame).padStart(3, '0')

function Fill({ rect }: { readonly rect: FillRect }) {
  return (
    <div
      className={styles.fill}
      style={{
        left: rect.x, top: rect.y, width: Math.max(0, rect.width), height: Math.max(0, rect.height),
        background: rect.color,
        // ⚠️ 0x6b7d4 의 둥근 칠(둥글기 ≤ 3 은 선 긋기, 7 상한)은 웹이 border-radius 로 갈음한다 (근사)
        borderRadius: rect.round,
      }}
      data-testid="판칠"
    />
  )
}

function FrameImage(
  { folder, frame, size, at, testId }: {
    readonly folder: string; readonly frame: number; readonly size: FrameSize; readonly at: Placed; readonly testId: string
  },
) {
  return (
    <img
      className={styles.sprite}
      style={{ left: at.x + size.x, top: at.y + size.y }}
      src={`${folder}/${pad(frame)}.png`}
      alt=""
      data-testid={testId}
      data-frame={frame}
    />
  )
}

/** img_text 글자를 박스에 (0xb9e8c) — 크기를 모르는 프레임은 그리지 않는다 */
function Label(
  { frame, cardBox, anchor, origin, testId }: {
    readonly frame: number; readonly cardBox: CardBox; readonly anchor: number; readonly origin: Placed; readonly testId: string
  },
) {
  const size = IMG_TEXT_FRAMES[frame]
  if (size === undefined) return null
  return (
    <FrameImage folder={IMG_TEXT_FOLDER} frame={frame} size={size} at={framePlacementOf(cardBox, size, anchor, origin)} testId={testId} />
  )
}

/** game_ui 칸을 박스에 (0xb9e8c, 정렬 0x11) */
function Chip(
  { frame, cardBox, origin, testId }: {
    readonly frame: number; readonly cardBox: CardBox; readonly origin: Placed; readonly testId: string
  },
) {
  const size = GAME_UI_FRAMES[frame]
  if (size === undefined) return null
  return (
    <FrameImage folder={GAME_UI_FOLDER} frame={frame} size={size} at={framePlacementOf(cardBox, size, 0x11, origin)} testId={testId} />
  )
}

function Glyphs({ glyphs, testId }: { readonly glyphs: readonly NumberGlyph[]; readonly testId: string }) {
  return (
    <>
      {glyphs.map((glyph, index) => (
        <img
          key={index}
          className={styles.sprite}
          style={{ left: glyph.x, top: glyph.y }}
          src={`${NUM_FOLDER}/${pad(glyph.image)}.png`}
          alt=""
          data-testid={testId}
          data-image={glyph.image}
        />
      ))}
    </>
  )
}

function NameText({ name, cardBox, origin }: { readonly name: string; readonly cardBox: CardBox; readonly origin: Placed }) {
  return (
    <span
      className={styles.name}
      style={{
        left: origin.x + cardBox.x, top: origin.y + cardBox.y, width: cardBox.width, height: cardBox.height,
        color: CARD_COLORS.name,
      }}
      data-testid="이름"
    >
      {name}
    </span>
  )
}

/** 판 바탕 — 둥근 칠 두 겹 + game_ui 프레임 (0x44a76~0x44b02) */
function CardBase({ frame, origin }: { readonly frame: number; readonly origin: Placed }) {
  return (
    <>
      {cardBackgroundOf(origin).map((rect, index) => <Fill key={index} rect={rect} />)}
      <FrameImage folder={GAME_UI_FOLDER} frame={frame} size={GAME_UI_FRAMES[frame]} at={origin} testId="판" />
    </>
  )
}

/**
 * **투수·타자 소개 판 — 원본 `0x44944`** (경기 상태 0xe 그리기 `0x4d9ec` 의 마지막 함수).
 * 위에 투수 판, 아래에 타자 판이 양옆에서 밀려 들어온다 — 좌표·밀림·칸은 `matchupCardsLayout` 머리 주석 그대로다.
 * 상태 0xe 에 들어선 동안만 띄운다(0x44944 를 부르는 곳은 0x4d9ec 하나).
 */
export function MatchupCards({ tick, batterHand, side, pitcher, batter }: MatchupCardsProps) {
  const origins = cardOriginsAt(tick, batterHand, side)
  const p = origins.pitcher
  const b = origins.batter
  const pitcherLabel = pitcher.isComputer ? LABEL.computer : LABEL.player
  const batterLabel = batter.isComputer ? LABEL.computer : LABEL.player
  const roleBadge = pitcher.role === undefined ? null : pitcherRoleBadgeOf(pitcher.role, pitcherLabel)

  const era = pitcher.earnedRunAverage === undefined ? null : earnedRunAverageGlyphsOf(pitcher.earnedRunAverage, p)

  const positionBadge = batter.position === undefined
    ? null
    // 9 보다 크면 앞 판의 칸(0x545e8 이 안 넣었으면 0x44b9c 의 0)과 이 판 박스 1 글자가 남는다 — 앞 판 보직을 모르면 못 그린다
    : batter.position > 9 && roleBadge === null
      ? null
      : batterPositionBadgeOf(batter.position, roleBadge?.chip ?? 0, batterLabel)
  const average = batter.battingAverage === undefined ? null : battingAverageGlyphsOf(batter.battingAverage, b)

  return (
    <div className={styles.stage} data-testid="소개판">
      {/* ── 투수 판 (game_ui 프레임 1) ── */}
      <div data-testid="투수판" data-x={p.x} data-y={p.y}>
        <CardBase frame={PITCHER_CARD_FRAME} origin={p} />
        <Label frame={pitcherLabel} cardBox={PITCHER_BOXES[1]} anchor={0x11} origin={p} testId="투수팀" />
        {pitcher.name !== undefined && <NameText name={pitcher.name} cardBox={PITCHER_BOXES[3]} origin={p} />}
        {roleBadge !== null && (
          <>
            <Chip frame={roleBadge.chip} cardBox={PITCHER_BOXES[7]} origin={p} testId="보직칸" />
            <Label frame={roleBadge.label} cardBox={PITCHER_BOXES[7]} anchor={0x22} origin={p} testId="보직" />
          </>
        )}
        {pitcher.throwsLeft !== undefined && (
          <Label
            frame={pitcher.throwsLeft ? LABEL.leftPitcher : LABEL.rightPitcher}
            cardBox={PITCHER_BOXES[8]} anchor={0x22} origin={p} testId="투수손"
          />
        )}
        <Label frame={LABEL.earnedRun} cardBox={PITCHER_BOXES[4]} anchor={0x22} origin={p} testId="방어" />
        {era !== null && (
          <>
            <Glyphs glyphs={era.glyphs} testId="방어율" />
            <Fill rect={era.point} />
          </>
        )}
        <Label frame={LABEL.strikeout} cardBox={PITCHER_BOXES[5]} anchor={0x22} origin={p} testId="삼진" />
        {pitcher.strikeouts !== undefined && (
          <Glyphs glyphs={boxNumberGlyphsOf(pitcher.strikeouts, PITCHER_BOXES[6], p, NUMBER_BASE.stat, 1, 0x24)} testId="탈삼진" />
        )}
        {pitcher.stamina !== undefined && staminaGaugeRectsOf(pitcher.stamina, p).map((rect, index) => (
          <Fill key={`stamina-${index}`} rect={rect} />
        ))}
      </div>

      {/* ── 타자 판 (game_ui 프레임 2) ── */}
      <div data-testid="타자판" data-x={b.x} data-y={b.y}>
        <CardBase frame={BATTER_CARD_FRAME} origin={b} />
        <Label frame={batterLabel} cardBox={BATTER_BOXES[1]} anchor={0x11} origin={b} testId="타자팀" />
        {batter.name !== undefined && <NameText name={batter.name} cardBox={BATTER_BOXES[3]} origin={b} />}
        {positionBadge !== null && (
          <>
            {positionBadge.chip >= 0 && <Chip frame={positionBadge.chip} cardBox={BATTER_BOXES[7]} origin={b} testId="수비칸" />}
            {/* 글자만 1px 아래 (0x452e8 `adds r2,#1`) */}
            {positionBadge.label >= 0 && (
              <Label frame={positionBadge.label} cardBox={BATTER_BOXES[7]} anchor={0x22} origin={{ x: b.x, y: b.y + 1 }} testId="수비" />
            )}
          </>
        )}
        <Label
          frame={batterHand !== 0 ? LABEL.leftBatter : LABEL.rightBatter}
          cardBox={BATTER_BOXES[8]} anchor={0x22} origin={b} testId="타자손"
        />
        <Label frame={LABEL.average} cardBox={BATTER_BOXES[4]} anchor={0x22} origin={b} testId="타율칸" />
        {average !== null && (
          <>
            <Glyphs glyphs={average.glyphs} testId="타율" />
            <Fill rect={average.point} />
          </>
        )}
        <Label frame={LABEL.homeRun} cardBox={BATTER_BOXES[5]} anchor={0x22} origin={b} testId="홈런칸" />
        {batter.homeRuns !== undefined && (
          <Glyphs glyphs={boxNumberGlyphsOf(batter.homeRuns, BATTER_BOXES[6], b, NUMBER_BASE.stat, 1, 0x24)} testId="홈런" />
        )}
        <Label frame={LABEL.runsBattedIn} cardBox={BATTER_BOXES[10]} anchor={0x22} origin={b} testId="타점칸" />
        {batter.runsBattedIn !== undefined && (
          <Glyphs glyphs={boxNumberGlyphsOf(batter.runsBattedIn, BATTER_BOXES[9], b, NUMBER_BASE.stat, 1, 0x24)} testId="타점" />
        )}
        {batter.battingOrder !== undefined && (
          <Glyphs glyphs={boxNumberGlyphsOf(batter.battingOrder + 1, BATTER_BOXES[2], b, NUMBER_BASE.order, 1, 0x2)} testId="타순" />
        )}
        {batter.recentResults !== undefined && recentResultChipsOf(batter.recentResults, b).map((chip, index) => (
          <span key={index} data-testid="타석기록" data-label={chip.label}>
            <FrameImage folder={GAME_UI_FOLDER} frame={chip.frame} size={GAME_UI_FRAMES[chip.frame]} at={chip} testId="기록칸" />
            <FrameImage
              folder={IMG_TEXT_FOLDER} frame={chip.label} size={IMG_TEXT_FRAMES[chip.label]}
              at={{ x: chip.labelX, y: chip.labelY }} testId="기록글자"
            />
          </span>
        ))}
      </div>
    </div>
  )
}
