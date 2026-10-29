import { IMG_TEXT_FRAMES, PANEL, PANEL_X, STRIP_HEIGHT, STRIP_LEVEL, STRIP_OPACITY, TRAINNING_FRAMES } from './hudPanel'
import type { HudSprite } from './hudPanel'
import { COUNTER_BASE, slashCounterGlyphsOf } from './hudCounter'
import type { HudGlyph } from './hudCounter'
import { TIMER_STRIP } from './hudTimer'

export interface LimitStrip {
  /** 띠 — 합성 프레임 13, 반투명 10/16 */
  readonly strip: HudSprite
  /** img_text 글 그림 (팔레트 0) */
  readonly label: HudSprite
  readonly glyphs: readonly HudGlyph[]
}

export interface MissionLimitState {
  readonly plateAppearanceLimit: number
  /** 쓴 타석 — 미션 기록 R+0xe8 (웹 = 한도 − 남은 타석) */
  readonly plateAppearancesUsed: number
  readonly swingLimit: number
  /** 쓴 스윙 — R+0xf0 (웹 = 한도 − 남은 스윙) */
  readonly swingsUsed: number
  /**
   * 모드 5 투수 미션 — 행[9] 아랫 4비트(투구 한도) · 던진 공 P+0x1c. 주면 스윙 띠 대신 "투구" 띠(img_text 0x107)를 그린다
   */
  readonly pitches?: { readonly limit: number; readonly thrown: number }
}

/** 0x369f6 · 0x36b04 — 타석 띠 · 스윙 띠 */
export function limitStripsOf(state: MissionLimitState): LimitStrip[] {
  const strips: LimitStrip[] = []
  // 앞 띠 높이 기준 — 0x36a16 [sp+0x44] = h + 8 (판 높이), 0x36b24 는 그때 [sp+0x7a](마지막 0xba815 상자 높이)를 더한다
  let previousTop = 6
  let previousHeight: number = PANEL.height
  if (state.plateAppearanceLimit > 0) {
    const top = PANEL.height + 8
    strips.push({
      strip: { src: `${TRAINNING_FRAMES}/013.png`, left: PANEL_X, top, opacity: STRIP_OPACITY },
      label: { src: `${IMG_TEXT_FRAMES}/262.png`, left: PANEL_X + 6, top: PANEL.height + 0xc },
      // 0x36adc: 지금 타석 = min(쓴 타석 + 1, 한도)
      glyphs: slashCounterGlyphsOf(
        Math.min(state.plateAppearancesUsed + 1, state.plateAppearanceLimit),
        state.plateAppearanceLimit,
        PANEL_X + 0x31,
        top + 4,
        COUNTER_BASE.white,
      ),
    })
    previousTop = top
    previousHeight = STRIP_HEIGHT
  }
  // 36b04 — 모드 6 스윙 한도(img_text 0x108) · 모드 5 투구 한도(0x107)
  const second =
    state.pitches === undefined
      ? { limit: state.swingLimit, used: state.swingsUsed, label: 264 }
      : { limit: state.pitches.limit, used: state.pitches.thrown, label: 263 }
  if (second.limit > 0) {
    const base = previousTop + previousHeight
    strips.push({
      strip: { src: `${TRAINNING_FRAMES}/013.png`, left: PANEL_X, top: base + 2, opacity: STRIP_OPACITY },
      label: { src: `${IMG_TEXT_FRAMES}/${second.label}.png`, left: PANEL_X + 6, top: base + 6 },
      glyphs: slashCounterGlyphsOf(second.used, second.limit, PANEL_X + 0x31, base + 6, COUNTER_BASE.white),
    })
  }
  return strips
}

/**
 * **타석 캔버스가 그리는 띠** (Q-03 r301) — 0x36714 의 효과 1 · 10 띠 셋(타석 0x369f6 · 스윙/투구 0x36b04 · 시계 0x36c04, 이 차례)은
 * 점수판 0x373d0 끝에서 화면에 섞이므로 DOM 불투명도 대신 타석 캔버스(`BattingStage` · `PitcherSideStage` 의 `missionStrips`)가
 * 원본 식으로 그린다. 띠 위 글 · 숫자 · 시계 그림은 `MissionHud` 가 그대로 DOM 으로 얹는다(`stripsOnStage`).
 */
export function missionStageStripsOf(
  limits: MissionLimitState,
  remainingSeconds: number | null,
): readonly { readonly src: string; readonly x: number; readonly y: number; readonly level: number }[] {
  const strips = limitStripsOf(limits).map((strip) => strip.strip)
  if (remainingSeconds !== null && remainingSeconds > 0) strips.push(TIMER_STRIP)
  return strips.map((strip) => ({ src: strip.src, x: strip.left, y: strip.top, level: STRIP_LEVEL }))
}
