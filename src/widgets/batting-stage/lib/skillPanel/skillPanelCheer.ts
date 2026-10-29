/** 함성 29 (4c26a~4c3a2) · 비트 칸 skin+0x44c · 경기 장면 수명의 판 칸 */
import { has } from '@/widgets/batting-stage/lib/skillPanel/skillPanelBits'
import { SKILL_PANEL_IDLE, type SkillPanelState } from '@/widgets/batting-stage/lib/skillPanel/skillPanelState'

/** 함성 29 (0x4c39a) */
export const SKILL_CHEER_SOUND_ID = 29

/** 비트 칸 처음 값 — 0x3301c 33044~33056 */
export const SKILL_CHEER_BITS_START = 0x3ff

/**
 * 경기 장면 수명의 칸 — 판 상태(장면 +0x19b0 ~ +0x19c0) · 비트 칸 skin+0x44c(측 0) · +0x44e(측 1) · 애니 7 · 8 을 그린 수.
 * 타석 화면이 메뉴 · 수비 화면으로 내려갔다 다시 서도 판이 이어진다(원본은 장면이 하나다).
 */
export interface SkillPanelScene {
  panel: SkillPanelState
  cheerBits: [number, number]
  arrowDraws: number
  /** 마지막으로 본 0xd 진입 열쇠 · 그 뒤 0xf 진입을 아직 안 지났는가 (`BattingStage.skillPanel.entryKey`) */
  entryKey: unknown
  isAtBatPending: boolean
}

/** 경기 장면 초기화 0x3301c — 비트 칸 두 측 0x3ff, 판은 꺼짐 */
export function createSkillPanelScene(): SkillPanelScene {
  return {
    panel: SKILL_PANEL_IDLE,
    cheerBits: [SKILL_CHEER_BITS_START, SKILL_CHEER_BITS_START],
    arrowDraws: 0,
    entryKey: null,
    isAtBatPending: false,
  }
}

/** 함성 검사의 재료 */
export interface SkillCheerInput {
  /** st[9] — 공격 측 */
  readonly attackSide: number
  /** 0xb6394(타자) */
  readonly batterRecordSlot: number
  /** 지금 타자 레코드 +0x14 */
  readonly batterSkillBits: number
}

/** 4c27a~4c39a — 함성 29 를 내면 그 칸 비트를 끈 새 칸, 아니면 null */
export function skillCheerOf(cheerBits: readonly [number, number], input: SkillCheerInput): [number, number] | null {
  const side = input.attackSide !== 0 ? 1 : 0
  const slot = input.batterRecordSlot & 0x1f
  const mask = 2 ** slot
  // ldrb — 낮은 바이트만 본다. 칸 8 이상은 늘 0 이라 울지 않는다(원본 그대로)
  const isSet = mask <= 0x80 && (cheerBits[side] & 0xff & mask) !== 0
  if (!isSet || !(has(input.batterSkillBits, 2) || has(input.batterSkillBits, 1))) return null
  const next: [number, number] = [cheerBits[0], cheerBits[1]]
  next[side] = (cheerBits[side] ^ mask) & 0xffff
  return next
}

/**
 * 0x668cc(스킨, 팀, 0) 668fe~6694a — 측 = st[9] ≠ 0 ? 1 : 0, 칸 = 0xb6394(0xae89c(팀)) 의 비트가 꺼져 있으면 세운다(strh — 칸 16 이상은
 * 안 남는다). 0x16 진입 대타 가지에서는 확정 앞이라 **나가는 타자**의 칸이다
 */
export function restoreCheerBit(cheerBits: readonly [number, number], attackSide: number, batterRecordSlot: number): [number, number] {
  const side = attackSide !== 0 ? 1 : 0
  const next: [number, number] = [cheerBits[0], cheerBits[1]]
  const slot = batterRecordSlot & 0x1f
  if (slot < 16) next[side] = (cheerBits[side] | (1 << slot)) & 0xffff
  return next
}
