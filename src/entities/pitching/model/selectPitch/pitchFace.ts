import type { PitcherRepertoireInfo } from '@/entities/pitching/model/pitch'
import { PITCH_TYPES } from '@/shared/config/original/pitchTypes'
import { ROSTER_PITCHER_REPERTOIRES } from '@/shared/config/original/pitcherRepertoires'
import { ZONE_CENTERS, type WorldPoint } from '@/entities/pitching/model/pitchCurve'
import { MAGIC_PITCH_TYPE_NUMBER, magicPitchNameOf } from '@/entities/pitching/model/selectPitch/otherSlices'

/**
 * 마선수가 아닌 상대 투수의 레퍼토리 — 웹은 상대 투수 명단을 고르지 않아 원본 투수 명단 첫 선수(봉은중)의
 * 구질을 쓰고, 화면 투수 그림이 반전되지 않으니 폼은 0 으로 둔다 (추정)
 */
export const DEFAULT_REPERTOIRE: PitcherRepertoireInfo = { form: 0, pitchMask: ROSTER_PITCHER_REPERTOIRES[0].pitchMask, magicId: 0 }

/** 마구 이름을 못 고를 때 쓰는 글자 — `features/play-pitcher-game` 의 사람 투구와 같은 대체값 */
const MAGIC_PITCH_NAME = '마구'

/** 존 표시 반폭 (월드) — 목표 종류 1·2 의 최대 거리 331·329. 스트라이크 판정 경계로 쓴다 (추정: 원본 판정 위치 미확인) */
const ZONE_HALF_WORLD = { x: 331, y: 329 }

export function plateOf(target: WorldPoint, side: number) {
  const center = ZONE_CENTERS[side] ?? ZONE_CENTERS[0]
  return { x: (target.x - center.x) / ZONE_HALF_WORLD.x, y: (target.y - center.y) / ZONE_HALF_WORLD.y }
}

/** 구질 번호 → 원본 구질 표 행 (없으면 첫 행) */
export function pitchTypeRowOf(typeNumber: number) {
  return PITCH_TYPES[typeNumber - 1] ?? PITCH_TYPES[0]
}

/** 마구(구질 22)인가 */
export const isMagicTypeNumber = (typeNumber: number) => typeNumber === MAGIC_PITCH_TYPE_NUMBER

/** 공 이름 — 마구면 마구 이름(못 고르면 '마구'), 아니면 구질 표 이름 */
export function pitchNameOf(typeNumber: number, repertoire: PitcherRepertoireInfo): string {
  if (!isMagicTypeNumber(typeNumber)) return pitchTypeRowOf(typeNumber).name
  return magicPitchNameOf(repertoire.magicId, repertoire.form) ?? MAGIC_PITCH_NAME
}
