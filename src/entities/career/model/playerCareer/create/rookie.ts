import type { BatterAbility } from '@/entities/batting/model/batter'
import { BALANCE } from '@/shared/config/original/balance'

/** 타자 시작 능력치 표 0xcc3fa (배팅 타입 → 히트·파워·수비·주루) */
const ROOKIE_ABILITY_BY_TYPE: readonly BatterAbility[] = BALANCE.ability.rookieByBattingType
/** 생성 화면 둘째 목록(0 내야 · 1 외야, StrMODE[4])이 0 이면 수비, 아니면 주루에 더한다 (0x16e2c) */
const ROOKIE_POSITION_BONUS = BALANCE.ability.rookiePositionBonus

export function rookieAbilityOf(battingTypeIndex: number, positionIndex: number): BatterAbility {
  const base = ROOKIE_ABILITY_BY_TYPE[battingTypeIndex] ?? ROOKIE_ABILITY_BY_TYPE[0]
  return positionIndex === 0 ? { ...base, defense: base.defense + ROOKIE_POSITION_BONUS } : { ...base, run: base.run + ROOKIE_POSITION_BONUS }
}

/** 등록 화면 기본 선택(0, 0)의 능력치 */
export const STARTING_ABILITY: BatterAbility = rookieAbilityOf(0, 0)

/** 선수 등록 선택 (0x16f28 — 선수 +0xb: 비트5~7 타입, 비트0~1 내외야, 비트4 손 [추]) */
export interface RookieProfile {
  readonly battingTypeIndex: number
  /** 0 내야 · 1 외야 (StrMODE[4]) */
  readonly positionIndex: number
  /** 0 우타 · 1 좌타 (StrMODE[9], 판정의 side 와 같은 뜻) */
  readonly battingSide: number
  /** 0 황인 · 1 백인 · 2 흑인 (선수 +0xb 비트2~3) */
  readonly skinIndex: number
  /**
   * 팀 고르기(상태 0x65)에서 고른 팀 — 목록 값 0~14 그대로다 (C-1: 몸통 팔레트 = 피부×15 + 팀).
   * 안 넘기면 기본 팀(서울 드래곤즈)이다.
   */
  readonly teamId?: number
}

export const DEFAULT_ROOKIE_PROFILE: RookieProfile = { battingTypeIndex: 0, positionIndex: 0, battingSide: 0, skinIndex: 0 }

/** 이름 길이 — 원본은 CP949 바이트로 센다. 한글 2바이트, 영문·숫자 1바이트 (StrMODE[3] "한글 4글자, 영문 8글자") */
export const MAXIMUM_NAME_BYTES = BALANCE.limits.nameBytes

export function nameByteLengthOf(name: string): number {
  return [...name].reduce((total, character) => total + (character.charCodeAt(0) > 0x7f ? 2 : 1), 0)
}
