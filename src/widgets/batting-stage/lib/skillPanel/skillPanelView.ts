/** 그림 한 장(4b5b4 의 4b67e~4c266)과 한 그림 걸음 */
import {
  BATTER_ICON_ORIGIN,
  type SkillPanelIcon,
  pitcherIconOriginOf,
  placedIconsOf,
  skillArrowEntryOf,
  skillIconSlotsOf,
} from '@/widgets/batting-stage/lib/skillPanel/skillPanelIcons'
import { type SkillPanelSheet, skillPanelSheetOf, skillPanelXOf } from '@/widgets/batting-stage/lib/skillPanel/skillPanelSheet'
import type { SkillPanelState } from '@/widgets/batting-stage/lib/skillPanel/skillPanelState'

/** 0xb6c20 · 아이콘 · 밀림 재료 — 그림 한 장을 정하는 것 */
export interface SkillPanelDrawSource {
  /** 0xb63c0(지금 타자) — 판의 쪽 · 투수 앵커 칸(+0x17e1) */
  readonly batterHand: number
  /** 0xb6c20(st, st[0xa]) — 수비 측이 CPU 인가 */
  readonly isDefenseCpu: boolean
}

/** 그림 한 장 */
export interface SkillPanelView {
  readonly x: number
  readonly batter: SkillPanelSheet | null
  readonly batterIcons: readonly SkillPanelIcon[]
  readonly pitcher: SkillPanelSheet | null
  readonly pitcherIcons: readonly SkillPanelIcon[]
  /** 애니 7 · 8 이 이 그림에서 그리는 칸 (0 · 1) */
  readonly arrowEntry: number
}

/** 그림 한 장 (4b5b4 의 4b67e~4c266) — 수명이 남았을 때만 부른다 */
export function skillPanelViewOf(state: SkillPanelState, source: SkillPanelDrawSource, arrowDraws: number): SkillPanelView {
  return {
    x: skillPanelXOf(state.tick, source.batterHand),
    batter: skillPanelSheetOf(state.batterBits, false),
    batterIcons: placedIconsOf(skillIconSlotsOf(state.batterBits, true), BATTER_ICON_ORIGIN),
    pitcher: skillPanelSheetOf(state.pitcherBits, true),
    pitcherIcons: placedIconsOf(skillIconSlotsOf(state.pitcherBits, false), pitcherIconOriginOf(source)),
    arrowEntry: skillArrowEntryOf(arrowDraws),
  }
}

/**
 * 한 그림 — 수명이 남았으면 그 그림의 모습과 다음 상태, 다 됐으면(4b62c) 비트 · 틱을 지운 상태와 null.
 * 함성은 `cheerPending` 인 그림에서 부르는 쪽이 `skillCheerOf` 로 본다.
 */
export function stepSkillPanel(
  state: SkillPanelState,
  source: SkillPanelDrawSource,
  arrowDraws: number,
): { readonly view: SkillPanelView | null; readonly next: SkillPanelState } {
  if (state.remaining <= 0) return { view: null, next: { ...state, batterBits: 0, pitcherBits: 0, tick: 0 } }
  const view = skillPanelViewOf(state, source, arrowDraws)
  return { view, next: { ...state, tick: state.tick + 1, remaining: state.remaining - 1, cheerPending: false } }
}

// ── 그리기 ──
