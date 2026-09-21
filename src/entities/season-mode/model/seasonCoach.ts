import { MONEY_LIMIT, NO_COACH, clampTo } from '@/entities/season-mode/model/seasonRecord'
import type { SeasonRecord } from '@/entities/season-mode/model/seasonRecord'
import { ACE_PLAYERS } from '@/shared/config/original/acePlayers'
import type { AcePlayer } from '@/shared/config/original/acePlayers'
import { ORIGINAL_MODE_TEXT } from '@/shared/config/original/modeText'
import { stripGameMarkup } from '@/shared/lib/gameMarkup/gameMarkup'

/**
 * 코치채용 (구단관리 하위 칸 3 → 선수단 화면 0xd7 을 `this+0x11c = 2` 로 띄운다).
 *
 * 근거: `docs/re/J-modes-rules.md` 4-2·4-3 **확정** (화면 0xaa24 · 채용 0xa248),
 * `docs/re/P4-season-flow.md` 0·1b 절, `docs/re/R13-season-leftovers.md` 표(0xd7 = 0xaa24).
 *
 * 코치는 **한 명뿐**이고 바꾸면 계약금을 새로 낸다(이전 코치 환불 없음 — 차감 코드만 있다).
 * 보너스는 경기 능력치 쪽(`features/play-team-game/model/gameAbilities.ts` 의 `coachBonusOf`)이
 * 이미 들고 있다 — 여기서는 **고르기·가드·차감**만 맡는다.
 */

/** 코치 칸 수 — 마투수 5 + 마타자 5 (표 두 줄) */
export const COACH_COUNT = 10
/** 표 한 줄(= 마투수 줄) 칸 수. 칸 = 줄×열수 + 열 이라 0~4 가 마투수, 5~9 가 마타자다 */
export const COACH_ROW_SIZE = 5

/**
 * 계약금 표 `0xcbc24` s8 **[10, 15, 20, 25, 35] × 2** (마투수 줄 0~4 · 마타자 줄 5~9).
 * 표시는 `값 × 1000` 만원 = 1억 · 1.5억 · 2억 · 2.5억 · 3.5억 (StrMODE[159] "계약금 : %s").
 */
export const COACH_CONTRACT_TABLE: readonly number[] = [10, 15, 20, 25, 35, 10, 15, 20, 25, 35]
/** 실제 차감은 `소지금(100만 단위) −= 표값 × 10` 이다 (0xa29e~0xa2be) — 표시 금액과 같은 값 */
export const COACH_FEE_SCALE = 10
/** 필요 인기도 표 `0xcbc10` s16 **[0, 100, 300, 500, 1000] × 2** (StrMODE[160]) */
export const COACH_REQUIRED_POPULARITY: readonly number[] =
  [0, 100, 300, 500, 1000, 0, 100, 300, 500, 1000]

/** StrMODE[149]~[158] — 코치 칸별 보너스 설명 (표 0xd884c 의 값이 그대로 문구에 적혀 있다) */
const COACH_EFFECT_FIRST_TEXT = 149

/** 마선수 목록에서 투수·타자를 갈라 둔다 — 원본 표의 줄 0 이 마투수, 줄 1 이 마타자다 */
const ACE_PITCHERS = ACE_PLAYERS.filter((ace) => ace.role === '투수')
const ACE_BATTERS = ACE_PLAYERS.filter((ace) => ace.role === '타자')

function isCoachSlot(slot: number): boolean {
  return Number.isInteger(slot) && slot >= 0 && slot < COACH_COUNT
}

/** 코치 칸 → 마선수 (0~4 마투수 · 5~9 마타자). 없는 칸이면 null */
export function coachAceOf(slot: number): AcePlayer | null {
  if (!isCoachSlot(slot)) return null
  return (slot < COACH_ROW_SIZE ? ACE_PITCHERS[slot] : ACE_BATTERS[slot - COACH_ROW_SIZE]) ?? null
}

/** 코치 이름 = 그 마선수 이름 (StrMODE[146]/[148] 의 `%s`) */
export function coachNameOf(slot: number): string {
  return coachAceOf(slot)?.name ?? ''
}

/** 계약금 (소지금과 같은 **100만 원 단위**) — 표값 × 10 */
export function coachFeeOf(slot: number): number | null {
  if (!isCoachSlot(slot)) return null
  return (COACH_CONTRACT_TABLE[slot] ?? 0) * COACH_FEE_SCALE
}

/** 필요 인기도 (StrMODE[160] "필요 인기도 : %d") */
export function coachRequiredPopularityOf(slot: number): number | null {
  if (!isCoachSlot(slot)) return null
  return COACH_REQUIRED_POPULARITY[slot] ?? null
}

/** 보너스 설명 글 — StrMODE[149 + 칸] 을 마크업만 걷어 그대로 쓴다 */
export function coachEffectTextOf(slot: number): string {
  if (!isCoachSlot(slot)) return ''
  return stripGameMarkup(ORIGINAL_MODE_TEXT[COACH_EFFECT_FIRST_TEXT + slot] ?? '')
}

export type CoachHireRefusal = '없는칸' | '이미채용' | '소지금부족' | '인기도부족'

export type CoachHireCheck =
  | { readonly ok: true; readonly fee: number }
  | { readonly ok: false; readonly reason: CoachHireRefusal; readonly required?: number }

/**
 * 채용 가드 — 원본 `0xa79c~` 의 **순서 그대로** (J 4-3 확정):
 *   ① 이미 이 코치 → StrMODE[147] ② 소지금 < 값×10 → StrMODE[77]
 *   ③ 인기도 < 필요 → StrMODE[62] ④ 확인 StrMODE[146] → 채용 StrMODE[148]
 *
 * ⚠️ **안 넣은 가드**: 설명서(StrHOWTO[23])는 "현재 오픈된 마선수만 코치로 채용할 수 있다" 고
 * 적지만 J 4-3 이 "오픈 안 된 마선수 거절 위치는 미확인" 이라 적었다 — 코드 자리를 모르니
 * 지어내지 않고 **열 칸 모두 고를 수 있게** 두었다.
 */
export function checkCoachHire(
  record: SeasonRecord,
  popularity: number,
  slot: number,
): CoachHireCheck {
  const fee = coachFeeOf(slot)
  const required = coachRequiredPopularityOf(slot)
  if (fee === null || required === null) return { ok: false, reason: '없는칸' }

  if (record.coach === slot) return { ok: false, reason: '이미채용' }
  if (record.money < fee) return { ok: false, reason: '소지금부족', required: fee }
  if (popularity < required) return { ok: false, reason: '인기도부족', required }
  return { ok: true, fee }
}

/**
 * 채용 확정 — `0xa248`: `소지금 −= 값×10` (0..9999 로 자름) · `SR+0x185 = 칸`.
 * ⚠️ 이전 코치의 계약금을 **돌려주지 않는다** (차감 코드만 있다).
 * 가드는 부르는 쪽이 `checkCoachHire` 로 먼저 본다 (원본도 키 처리와 팝업 결과가 나뉘어 있다).
 */
export function hireCoach(record: SeasonRecord, slot: number): SeasonRecord {
  const fee = coachFeeOf(slot)
  if (fee === null) return record
  return { ...record, money: clampTo(record.money - fee, MONEY_LIMIT), coach: slot }
}

/** 지금 코치가 있는가 (SR+0x185 ≠ −1) */
export function hasCoach(record: SeasonRecord): boolean {
  return record.coach !== NO_COACH
}
