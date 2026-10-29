import type { MenuItem } from '@/shared/ui'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { pitcherAbilityLimitsOf } from '@/entities/pitcher-career/model/pitcherCareer'
import type { PitcherCareer } from '@/entities/pitcher-career/model/pitcherCareer'
import {
  MAGIC_MAXIMUM_LEVEL,
  MAGIC_REQUIRED_POPULARITY,
  PITCHER_TRAINING_MENUS,
  type magicTrainingCellBlockOf,
} from '@/entities/pitcher-career/model/pitcherManagement'
import type { PitcherTrainingBlockReason } from '@/entities/pitcher-career/model/pitcherManagement'
import {
  PITCHER_COMMAND_SLOTS,
  PITCHER_ITEM_SLOTS,
  PITCHER_MANAGEMENT_TEXT,
  PITCHER_PLAYER_INFO_SLOTS,
  abilityAtLimitTextOf,
  popularityShortageTextOf,
} from '@/pages/pitcher-league/lib/pitcherManagementMenu'
import type { PitcherMenuKind } from './menuTypes'

/** 105 로 돌아오는 결과 상태 — 125 훈련 결과(0x18dd8 · 0x1b5b8) · 127 휴식(0x1b466) (`onReenter` 의 `from`) */
export const TRAINING_RESULT_STATE = 0x7d
export const REST_STATE = 0x7f

/** StrMODE 글 — 화면이 `!C` 를 붙여 그리므로 앞의 가운데 맞춤 표시는 뗀다 */
export const modeTextOf = (index: number): string => (ORIGINAL_MODE_TEXT[index] ?? '').replace(/^!C/, '')

/** 107 칸이 막힌 까닭의 알림 글 (키 0x12d48) */
export function trainingBlockNoticeOf(reason: PitcherTrainingBlockReason, slot: number, magicLevel: number): string {
  if (reason === '사기부족') return PITCHER_MANAGEMENT_TEXT.moraleEmpty
  // StrMODE[192] — %s 는 그 칸의 능력치 이름 StrMODE[0x28 + 칸] (키 0x12d48 12ef2~12f10)
  if (reason === '능력치최대') return abilityAtLimitTextOf(slot)
  // StrMODE[62] — 마구 레벨마다 필요한 인기도 (표 0xcc3ea)
  if (reason === '인기도부족') return popularityShortageTextOf(MAGIC_REQUIRED_POPULARITY[magicLevel] ?? 0)
  /*
   * ⚠️ `pitcherTrainingBlockReasonOf` 는 "마구를 다 배웠다" 와 "G포인트가 모자란다" 를
   *    **한 값('훈련완료')으로 묶어** 돌려준다 (entities 쪽 그대로 둔다).
   *    글만 여기서 갈라 준다 — 다 배웠으면 StrMODE[63](108 창 0x17828 과 같은 글), G 부족은 [65].
   */
  return magicLevel >= MAGIC_MAXIMUM_LEVEL ? PITCHER_MANAGEMENT_TEXT.magicAllTrained : PITCHER_MANAGEMENT_TEXT.gamePointShortage
}

/** 108 마구 창 확인 키 0x17828 — 알림만 띄우고 끝나는 막힘의 글. G 부족(질문 [65])과 막힘 없음은 null */
export function magicCellBlockNoticeOf(block: ReturnType<typeof magicTrainingCellBlockOf>, cell: number): string | null {
  if (block === '훈련완료') return modeTextOf(63)
  if (block === '인기도부족') return modeTextOf(62).replace('%d', String(MAGIC_REQUIRED_POPULARITY[cell] ?? 0))
  if (block === '선행필요') return modeTextOf(64)
  return null
}

const slotItemOf = (slot: { readonly id: string }): MenuItem => ({ id: slot.id, label: slot.id })

/** 메뉴 칸 — 105 · 106 · 110 은 칸 이름 그대로, 107 은 칸 0~3 "지금 값 / 보직 한계"(0xa44f4) · 칸 4(마구)는 레벨 */
export function pitcherMenuItemsOf(kind: PitcherMenuKind, career: PitcherCareer): readonly MenuItem[] {
  if (kind === '선수정보') return PITCHER_PLAYER_INFO_SLOTS.map(slotItemOf)
  if (kind === '아이템') return PITCHER_ITEM_SLOTS.map(slotItemOf)
  if (kind !== '트레이닝') return PITCHER_COMMAND_SLOTS.map(slotItemOf)
  const limits = pitcherAbilityLimitsOf(career)
  return PITCHER_TRAINING_MENUS.map((menu) => ({
    id: menu.id,
    label: menu.name,
    detail: menu.ability === null ? `레벨 ${career.magicLevel}/${MAGIC_MAXIMUM_LEVEL}` : `${career.ability[menu.ability]}/${limits[menu.ability]}`,
  }))
}
