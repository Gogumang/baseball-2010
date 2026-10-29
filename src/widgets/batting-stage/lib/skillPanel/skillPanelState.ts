/** 판 상태(장면 +0x19b0 ~ +0x19c0) — 0xd · 0xf 진입이 비트를 쓰고 판을 세운다 */
import { has } from '@/widgets/batting-stage/lib/skillPanel/skillPanelBits'

/** 수명 +0x19b4 = 20 (48fc8 · 3dd8a) — 0xf ~ 0x11 그림마다 1 씩 줄어 20 그림을 그린다 */
export const SKILL_PANEL_LIFETIME = 20

/** 0xf 진입의 투수 비트 0x800 — 스킬 11(닥터K 27) 하나 (3dd7a) */
export const TWO_STRIKE_PITCHER_BITS = 1 << 11

/** 판 상태 — 장면 +0x19b0 · +0x19b4 · +0x19b8 · +0x19bc · +0x19c0 */
export interface SkillPanelState {
  readonly batterBits: number
  readonly pitcherBits: number
  /** +0x19b4 — 남은 그림 수 */
  readonly remaining: number
  /** +0x19b8 — 밀림 틱 */
  readonly tick: number
  /** +0x19b0 — 다음 그림이 함성 검사를 한다 */
  readonly cheerPending: boolean
}

export const SKILL_PANEL_IDLE: SkillPanelState = { batterBits: 0, pitcherBits: 0, remaining: 0, tick: 0, cheerPending: false }

const armed = (state: SkillPanelState): SkillPanelState => ({ ...state, remaining: SKILL_PANEL_LIFETIME, tick: 0, cheerPending: true })

/** 0xd 진입 48f9a~49006 — 두 비트를 새로 쓰고, 하나라도 서면 판을 세운다 (아니면 수명은 그대로) */
export function enterAtBatSkillPanel(state: SkillPanelState, batterBits: number, pitcherBits: number): SkillPanelState {
  const next = { ...state, batterBits, pitcherBits }
  return batterBits !== 0 || pitcherBits !== 0 ? armed(next) : next
}

/** 0xf 진입 3dd4e~3ddcc — 2 스트라이크이고 투수가 비트 11 이면 투수 비트를 0x800 하나로 두고 판을 다시 세운다 */
export function enterPitchSkillPanel(state: SkillPanelState, strikes: number, pitcherSkillBits: number): SkillPanelState {
  if (strikes !== 2 || !has(pitcherSkillBits, 11)) return state
  return armed({ ...state, pitcherBits: TWO_STRIKE_PITCHER_BITS })
}
