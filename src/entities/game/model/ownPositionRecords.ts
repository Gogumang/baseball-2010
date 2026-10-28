import { isBugFixed } from '@/shared/config/bugfixes'

/**
 * **나만의 선수 모드에서 자기 포지션 기록만 G 지급** (B-129, 사용자 결정 2026-10-28).
 *
 * 원본: 지급 게이트 0xa77f0 은 선수가 아니라 **팀** 의 조작 칸 state[0x31 + 팀]을 본다(a785e 공격 · a78bc 수비). 경기 준비
 * 0x39fdc 의 모드 3·4 갈래(0x3a20a~0x3a21e)가 내 팀 측 전체를 사람으로 정하므로, 나만의 타자는 동료 투수가 잡은 수비 기록
 * (16~31 · 36)을, 나만의 투수는 동료 타자가 친 공격 기록(0~15 · 32~35 · 37~39)을 받는다 (R8 4-1).
 *
 * 고친 길은 자기 포지션 쪽 기록만 남긴다 — 타자는 공격 쪽 전부(동료 타자 기록 포함), 투수는 투수 · 수비 쪽 전부.
 * 팀 경기(사람이 팀 전체를 조종)는 이 거름을 쓰지 않는다. 기록 판정은 난수를 굴리지 않으니 거름도 굴림 차례를 안 바꾼다.
 */
export const OWN_POSITION_RECORDS_BUGFIX_ID = 'B-129'

/** 나만의 선수가 맡은 자리 — 타자편(모드 4) · 투수편(모드 3) */
export type OwnPosition = 'batter' | 'pitcher'

/** 0xa77f0 a78bc 의 수비 쪽 범위 — 16 삼구 삼진 ~ 31 퍼펙트게임, 그리고 36 필살송구 아웃 */
const FIRST_DEFENSE_SIDE_RECORD = 16
const LAST_DEFENSE_SIDE_RECORD = 31
const LASER_THROW_OUT_RECORD = 36

export function isDefenseSideRecord(recordId: number): boolean {
  return (recordId >= FIRST_DEFENSE_SIDE_RECORD && recordId <= LAST_DEFENSE_SIDE_RECORD) || recordId === LASER_THROW_OUT_RECORD
}

const isOffenseSideRecord = (recordId: number): boolean => !isDefenseSideRecord(recordId)

const IS_OWN_POSITION_RECORD: Readonly<Record<OwnPosition, (recordId: number) => boolean>> = {
  batter: isOffenseSideRecord,
  pitcher: isDefenseSideRecord,
}

/** 진행기에 붙일 기록 번호 — 원본 길이면 그대로, 고친 길이면 자기 포지션 쪽만 */
export function ownPositionRecordIdsOf(recordIds: readonly number[], position: OwnPosition): readonly number[] {
  if (!isBugFixed(OWN_POSITION_RECORDS_BUGFIX_ID)) return recordIds
  return recordIds.filter(IS_OWN_POSITION_RECORD[position])
}
